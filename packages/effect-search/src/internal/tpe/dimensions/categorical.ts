/**
 * TPE categorical dimension — Parzen-based density estimation and candidate sampling for categorical parameters.
 *
 * @since 0.1.0
 */
import { log, logSumExp } from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Record,
  Tuple
} from "effect"

import * as Acquisition from "../../../Acquisition.js"
import { type Choice } from "../../../Distribution.js"
import type * as Rng from "../../../internal/rng.js"
import { categoricalQuantiles, mixtureComponents } from "../../../internal/tpe/candidates.js"
import { buildCategoricalParzen } from "../../../internal/tpe/categoricalParzen.js"
import * as Multi from "../../../internal/tpe/multivariateCategorical.js"
import { type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { InvalidSamplerConfig } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import { chooseBestCandidate, drawRolls } from "../candidateSelection.js"
import { logProbability } from "../scoring.js"
import { type CandidateRollPair, DimensionScoreTrace } from "./trace.js"
import { primitiveValuesForParameter } from "./values.js"

/**
 * Extracts all categorical dimensions from a search space as
 * `CategoricalDimension` descriptors for multivariate Parzen estimation.
 *
 * Non-categorical parameters are filtered out, producing the dimension
 * list consumed by {@link suggestMultivariateCategorical}.
 *
 * @see {@link suggestMultivariateCategorical} for joint categorical suggestion
 * @since 0.1.0
 * @category constructors
 */
export const categoricalDimensions = (
  space: SearchSpace.SearchSpace
): Array<Multi.CategoricalDimension> =>
  Arr.flatMap(space.params, (parameter) =>
    Match.value(parameter.distribution).pipe(
      Match.when({ type: "categorical" }, ({ choices }) =>
        Arr.of(
          new Multi.CategoricalDimension({
            name: parameter.name,
            choices: Arr.fromIterable(choices)
          })
        )),
      Match.orElse(() => Arr.empty<Multi.CategoricalDimension>())
    ))

/**
 * Suggests the best categorical value for a parameter by building Parzen
 * density estimators on below/above splits and scoring candidates via the
 * acquisition function.
 *
 * @see {@link categoricalCandidateTrace} for the underlying trace construction
 * @see {@link suggestMultivariateCategorical} for joint multi-dimension suggestion
 * @since 0.1.0
 * @category sampling
 */
export const suggestCategoricalParameter = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.Parameter,
  choicesInput: Iterable<Choice>,
  split: TrialSplit,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<Choice, InvalidSamplerConfig> => {
  const choices = Arr.fromIterable(choicesInput)
  return Bool.match(Num.Equivalence(choices.length, 1), {
    onFalse: () =>
      Effect.gen(function*() {
        const trace = yield* categoricalCandidateTrace(rng, nCandidates, parameter, choices, split, acquisition)

        return yield* chooseBestCandidate(
          trace.candidates,
          trace.scores,
          `tpe categorical candidate selection produced no candidate for parameter "${parameter.name}"`
        )
      }),
    onTrue: () => Effect.succeed(Option.getOrThrow(Arr.head(choices)))
  })
}

/**
 * Builds a full candidate trace for a categorical parameter from pre-drawn
 * rolls, returning candidates, log-densities, and acquisition scores.
 *
 * Separates randomness from density estimation so traces can be replayed
 * deterministically from a checkpoint.
 *
 * @see {@link categoricalCandidateTrace} for the convenience wrapper
 * @see {@link DimensionScoreTrace} for the output shape
 * @since 0.1.0
 * @category sampling
 */
export const categoricalCandidateTraceFromRolls = (
  parameter: SearchSpace.Parameter,
  choicesInput: Iterable<Choice>,
  split: TrialSplit,
  rollsInput: Iterable<CandidateRollPair>,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<DimensionScoreTrace<Choice>, InvalidSamplerConfig> => {
  const choices = Arr.fromIterable(choicesInput)
  const rolls = Arr.fromIterable(rollsInput)
  return Effect.gen(function*() {
    const belowValues = primitiveValuesForParameter(parameter, split.below)
    const aboveValues = primitiveValuesForParameter(parameter, split.above)
    const belowDensity = yield* buildCategoricalParzen(choices, belowValues)
    const aboveDensity = yield* buildCategoricalParzen(choices, aboveValues)
    const components = mixtureComponents(belowDensity.kernelWeights, Arr.map(rolls, ([component]) => component))
    const candidates = Arr.map(rolls, ([, value], index) =>
      Arr.head(
        categoricalQuantiles(
          choices,
          Arr.get(belowDensity.kernels, Arr.get(components, index).pipe(Option.getOrThrow)).pipe(Option.getOrThrow)
            .probabilities,
          [value]
        )
      ).pipe(Option.getOrThrow))
    const scoredCandidates = Arr.map(candidates, (candidate, index) => {
      const density = (model: typeof belowDensity) =>
        logSumExp(
          Chunk.fromIterable(Arr.map(model.kernels, (kernel, component) =>
            Num.sum(
              logProbability(choices, kernel.probabilities, candidate),
              log(Option.getOrThrow(Arr.get(model.kernelWeights, component)))
            )))
        )
      const logL = density(belowDensity)
      const logG = density(aboveDensity)

      return {
        logL,
        logG,
        score: Acquisition.score(
          new Acquisition.Context({
            logL,
            logG,
            estimatedCost: Option.none(),
            roll: Arr.get(rolls, index).pipe(Option.map((pair) => pair[1]))
          }),
          acquisition
        )
      }
    })

    return new DimensionScoreTrace({
      candidates: Chunk.fromIterable(candidates),
      logL: Arr.map(scoredCandidates, (candidate) => candidate.logL),
      logG: Arr.map(scoredCandidates, (candidate) => candidate.logG),
      scores: Arr.map(scoredCandidates, (candidate) => candidate.score),
      kernelLogL: Arr.map(
        candidates,
        (candidate) =>
          Arr.map(belowDensity.kernels, (kernel) => logProbability(choices, kernel.probabilities, candidate))
      ),
      kernelLogG: Arr.map(
        candidates,
        (candidate) =>
          Arr.map(aboveDensity.kernels, (kernel) => logProbability(choices, kernel.probabilities, candidate))
      ),
      weightsL: belowDensity.kernelWeights,
      weightsG: aboveDensity.kernelWeights
    })
  })
}

/**
 * Draws random rolls and delegates to {@link categoricalCandidateTraceFromRolls}
 * to produce a complete categorical dimension trace.
 *
 * This is the primary entry point for categorical dimension tracing in the
 * mixed-space suggestion pipeline.
 *
 * @see {@link categoricalCandidateTraceFromRolls} for the roll-based implementation
 * @see {@link suggestCategoricalParameter} for direct best-value selection
 * @since 0.1.0
 * @category sampling
 */
export const categoricalCandidateTrace = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.Parameter,
  choicesInput: Iterable<Choice>,
  split: TrialSplit,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<DimensionScoreTrace<Choice>, InvalidSamplerConfig> => {
  const choices = Arr.fromIterable(choicesInput)
  return Effect.gen(function*() {
    const components = yield* drawRolls(rng, nCandidates)
    const values = yield* drawRolls(rng, nCandidates)
    return yield* categoricalCandidateTraceFromRolls(
      parameter,
      choices,
      split,
      Arr.zip(components, values),
      acquisition
    )
  })
}

/**
 * Suggests a joint categorical assignment from a mixture of product kernels.
 * One observation component is shared by every dimension of a candidate;
 * densities multiply within components before summing the mixture.
 *
 * @see {@link categoricalDimensions} for extracting dimension descriptors
 * @see {@link suggestCategoricalParameter} for independent per-dimension suggestion
 * @since 0.1.0
 * @category sampling
 */
export const suggestMultivariateCategorical = (
  rng: Rng.Rng,
  nCandidates: number,
  space: SearchSpace.SearchSpace,
  split: TrialSplit,
  dimensionsInput: Iterable<Multi.CategoricalDimension>,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<unknown, InvalidSamplerConfig> => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  return Effect.gen(function*() {
    const fixed = Record.fromEntries(
      Arr.map(
        Arr.filter(dimensions, (dimension) => Num.Equivalence(dimension.choices.length, 1)),
        (dimension) => Tuple.make(dimension.name, Option.getOrThrow(Arr.head(dimension.choices)))
      )
    )
    const variable = Arr.filter(dimensions, (dimension) => Num.isGreaterThan(dimension.choices.length, 1))
    return yield* Bool.match(Arr.isReadonlyArrayEmpty(variable), {
      onFalse: () =>
        Effect.gen(function*() {
          const models = yield* Effect.forEach(variable, (dimension) =>
            Effect.gen(function*() {
              const parameter = yield* Effect.fromOption(
                Arr.findFirst(space.params, (entry) => Equal.equals(entry.name, dimension.name))
              )
              return {
                name: dimension.name,
                below: yield* buildCategoricalParzen(
                  dimension.choices,
                  primitiveValuesForParameter(parameter, split.below)
                ),
                above: yield* buildCategoricalParzen(
                  dimension.choices,
                  primitiveValuesForParameter(parameter, split.above)
                )
              }
            })).pipe(Effect.orDie)
          const first = yield* Effect.fromOption(Arr.head(models)).pipe(Effect.orDie)
          const rolls = yield* drawRolls(rng, nCandidates)
          const components = mixtureComponents(first.below.kernelWeights, rolls)
          const values = yield* Effect.forEach(models, (model) =>
            Effect.gen(function*() {
              const valueRolls = yield* drawRolls(rng, nCandidates)
              return Arr.map(components, (component, index) => {
                const kernel = Arr.get(model.below.kernels, component).pipe(Option.getOrThrow)
                const value = categoricalQuantiles(
                  model.below.choices,
                  kernel.probabilities,
                  [Arr.get(valueRolls, index).pipe(Option.getOrThrow)]
                )
                return Tuple.make(model.name, Arr.head(value).pipe(Option.getOrThrow))
              })
            }))
          const candidates = Arr.makeBy(nCandidates, (index) => ({
            ...fixed,
            ...Record.fromEntries(
              Arr.map(values, (entries) => Arr.get(entries, index).pipe(Option.getOrThrow))
            )
          }))
          const density = (candidate: Record<string, Choice>, side: "below" | "above") =>
            logSumExp(Chunk.fromIterable(
              Arr.map(first[side].kernelWeights, (weight, component) =>
                Num.sum(
                  log(weight),
                  Num.sumAll(Arr.map(models, (model) => {
                    const kernel = Arr.get(model[side].kernels, component).pipe(Option.getOrThrow)
                    return logProbability(
                      model[side].choices,
                      kernel.probabilities,
                      Record.get(candidate, model.name).pipe(Option.getOrThrow)
                    )
                  }))
                ))
            ))
          const scores = Arr.map(candidates, (candidate, index) => {
            const logL = density(candidate, "below")
            const logG = density(candidate, "above")

            return Acquisition.score(
              new Acquisition.Context({
                logL,
                logG,
                estimatedCost: Option.none(),
                roll: Arr.get(rolls, index)
              }),
              acquisition
            )
          })
          return yield* chooseBestCandidate(
            candidates,
            scores,
            "tpe categorical candidate selection produced no candidate"
          )
        }),
      onTrue: () => Effect.succeed(fixed)
    })
  })
}
