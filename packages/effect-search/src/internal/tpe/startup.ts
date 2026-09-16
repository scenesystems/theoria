/**
 * TPE startup routing — delegates to random sampling until enough history, then switches to model-driven suggestion.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Effect, Equal, HashMap, Match, Number as Num, Option, Record } from "effect"

import type * as Acquisition from "../../Acquisition.js"
import type * as Rng from "../../internal/rng.js"
import type { NoiseBandwidthOptions } from "../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../internal/tpe/splitTrials.js"
import type { Constraint, Context, Sampler } from "../../Sampler.js"
import type { InvalidSamplerConfig, SearchError } from "../../SearchError.js"
import * as SearchSpace from "../../SearchSpace.js"
import { rngByTrial } from "../sampler/rngByTrial.js"
import { enrichCompletedTrialsWithConstraints } from "./constraints/enrich.js"
import {
  categoricalDimensions,
  suggestCategoricalParameter,
  suggestMultivariateCategorical
} from "./dimensions/categorical.js"
import { suggestFloatParameter } from "./dimensions/float.js"
import { suggestIntParameter } from "./dimensions/int.js"
import { GroupedMixedSettings, suggestGroupedMixedJoint } from "./groupedMixed.js"
import { suggestMixedJoint } from "./mixed.js"
import { splitByObjective } from "./split.js"

const suggestIndependentParameter = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.Parameter,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions,
  acquisition: Acquisition.Acquisition
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) =>
      suggestCategoricalParameter(rng, nCandidates, parameter, choices, split, acquisition)),
    Match.when({ type: "float" }, ({ low, high, scale, step }) =>
      suggestFloatParameter(
        rng,
        nCandidates,
        parameter,
        low,
        high,
        Option.fromNullable(scale),
        Option.fromNullable(step),
        split,
        noiseOptions,
        acquisition
      )),
    Match.when({ type: "int" }, ({ low, high, step }) =>
      suggestIntParameter(rng, nCandidates, parameter, low, high, Option.fromNullable(step), split, acquisition)),
    Match.when({ type: "fidelity" }, ({ low, high }) =>
      suggestIntParameter(rng, nCandidates, parameter, low, high, Option.none(), split, acquisition)),
    Match.exhaustive
  )

const suggestIndependent = (
  rng: Rng.Rng,
  nCandidates: number,
  space: SearchSpace.SearchSpace,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions,
  acquisition: Acquisition.Acquisition
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const configObject = (raw: HashMap.HashMap<string, unknown>): unknown => Record.fromEntries(HashMap.toEntries(raw))

    const go = (
      index: number,
      raw: HashMap.HashMap<string, unknown>
    ): Effect.Effect<HashMap.HashMap<string, unknown>, InvalidSamplerConfig> =>
      Arr.get(space.params, index).pipe(
        Option.match({
          onNone: () => Effect.succeed(raw),
          onSome: (parameter) =>
            Match.value(SearchSpace.isParameterActive(parameter, configObject(raw))).pipe(
              Match.when(false, () => go(Num.increment(index), raw)),
              Match.orElse(() =>
                suggestIndependentParameter(
                  rng,
                  nCandidates,
                  parameter,
                  split,
                  noiseOptions,
                  acquisition
                ).pipe(
                  Effect.flatMap((value) => go(Num.increment(index), HashMap.set(raw, parameter.name, value)))
                )
              )
            )
        })
      )

    const raw = yield* go(0, HashMap.empty<string, unknown>())

    return configObject(raw)
  })

const hasConditionalParameters = (space: SearchSpace.SearchSpace): boolean =>
  Arr.some(space.params, (parameter) => Num.greaterThan(parameter.activeWhen.length, 0))

const suggestModelDriven = (
  seed: number,
  nCandidates: number,
  multivariate: boolean,
  groupDimensions: boolean,
  noiseOptions: NoiseBandwidthOptions,
  constraintsInput: Iterable<Constraint>,
  acquisition: Acquisition.Acquisition,
  space: SearchSpace.SearchSpace,
  context: Context
): Effect.Effect<unknown, InvalidSamplerConfig> => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Effect.gen(function*() {
    const completed = yield* enrichCompletedTrialsWithConstraints(context.completed, constraints)
    const rng = rngByTrial("tpe", seed, context.nextTrialNumber)
    const split = splitByObjective(completed, context.objectiveSpec, context.epsilon)
    const dimensions = categoricalDimensions(space)
    const containsConditionalParameters = hasConditionalParameters(space)
    const groupedSettings = new GroupedMixedSettings({
      multivariate,
      groupDimensions
    })

    return yield* Match.value(Bool.and(
      Equal.equals(dimensions.length, space.params.length),
      Bool.not(containsConditionalParameters)
    ))
      .pipe(
        Match.when(true, () => suggestMultivariateCategorical(rng, nCandidates, space, split, dimensions, acquisition)),
        Match.orElse(() =>
          Match.value(multivariate).pipe(
            Match.when(true, () =>
              Match.value(Bool.and(containsConditionalParameters, Bool.not(groupDimensions))).pipe(
                Match.when(true, () => suggestIndependent(rng, nCandidates, space, split, noiseOptions, acquisition)),
                Match.orElse(() =>
                  suggestGroupedMixedJoint(
                    rng,
                    nCandidates,
                    space,
                    split,
                    groupedSettings,
                    noiseOptions,
                    acquisition
                  )
                )
              )),
            Match.orElse(() =>
              Match.value(containsConditionalParameters).pipe(
                Match.when(true, () => suggestIndependent(rng, nCandidates, space, split, noiseOptions, acquisition)),
                Match.orElse(() => suggestMixedJoint(rng, nCandidates, space, split, noiseOptions, acquisition))
              )
            )
          )
        )
      )
  })
}

/**
 * Routes suggestion requests through the startup phase — delegates to random
 * sampling until `startupTrials` observations are collected, then switches
 * to the model-driven TPE suggest pipeline.
 *
 * The startup phase ensures the Parzen estimator has enough observations
 * to build meaningful density models before switching from exploration
 * to exploitation.
 *
 * @see {@link startupTrialsFromOptions} for configuring the phase boundary
 * @since 0.1.0
 * @category sampling
 */
export const suggestWithStartup = (
  randomSampler: Sampler,
  seed: number,
  startupTrials: number,
  nCandidates: number,
  multivariate: boolean,
  groupDimensions: boolean,
  noiseOptions: NoiseBandwidthOptions,
  constraintsInput: Iterable<Constraint>,
  acquisition: Acquisition.Acquisition,
  space: SearchSpace.SearchSpace,
  context: Context
): Effect.Effect<unknown, SearchError> => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Match.value(Num.lessThan(context.completed.length, startupTrials)).pipe(
    Match.when(true, () => randomSampler.suggest(space, context)),
    Match.orElse(() =>
      suggestModelDriven(
        seed,
        nCandidates,
        multivariate,
        groupDimensions,
        noiseOptions,
        constraints,
        acquisition,
        space,
        context
      )
    )
  )
}
