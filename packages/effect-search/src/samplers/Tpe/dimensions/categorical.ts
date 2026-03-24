/**
 * TPE categorical dimension — Parzen-based density estimation and candidate sampling for categorical parameters.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Option } from "effect"

import { type PrimitiveChoice } from "../../../contracts/Distribution.js"
import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import type * as Rng from "../../../internal/rng.js"
import { sampleWeightedCategoricalCandidatesFromRolls } from "../../../internal/tpe/candidates.js"
import { buildCategoricalParzen } from "../../../internal/tpe/categoricalParzen.js"
import * as Multi from "../../../internal/tpe/multivariateCategorical.js"
import { type CompletedTrialForSplit, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreAcquisition } from "../acquisition/index.js"
import { chooseBestCandidate, drawRolls } from "../candidates.js"
import { invalidConfig } from "../options.js"
import { logProbability } from "../scoring.js"
import { DimensionScoreTrace } from "./trace.js"
import { primitiveValuesForParameter } from "./values.js"

const tupleKeyFromTrial = (
  dimensions: Array<Multi.CategoricalDimension>,
  trial: CompletedTrialForSplit
): Effect.Effect<string, InvalidSamplerConfig> =>
  Multi.tupleFromConfig(dimensions, trial.config).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          invalidConfig(`tpe categorical history trial ${trial.trialNumber} does not match search-space dimensions`)
        ),
      onSome: (tupleConfig) => Effect.succeed(Multi.tupleKey(tupleConfig))
    })
  )

const tupleKeysFromTrials = (
  dimensions: Array<Multi.CategoricalDimension>,
  trials: ReadonlyArray<CompletedTrialForSplit>
): Effect.Effect<Array<string>, InvalidSamplerConfig> =>
  Effect.forEach(trials, (trial) => tupleKeyFromTrial(dimensions, trial))

/** @since 0.1.0 */
export const categoricalDimensions = (
  space: SearchSpace.SearchSpace
): Array<Multi.CategoricalDimension> =>
  space.params.flatMap((parameter) =>
    Match.value(parameter.distribution).pipe(
      Match.when({ type: "categorical" }, ({ choices }) => [
        new Multi.CategoricalDimension({
          name: parameter.name,
          choices: Arr.fromIterable(choices)
        })
      ]),
      Match.orElse(() => [])
    )
  )

/** @since 0.1.0 */
export const suggestCategoricalParameter = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  choices: ReadonlyArray<PrimitiveChoice>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<PrimitiveChoice, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const trace = yield* categoricalCandidateTrace(rng, nCandidates, parameter, choices, split, acquisition)

    return yield* chooseBestCandidate(
      trace.candidates,
      trace.scores,
      `tpe categorical candidate selection produced no candidate for parameter "${parameter.name}"`
    )
  })

/** @since 0.1.0 */
export const categoricalCandidateTraceFromRolls = (
  parameter: SearchSpace.ParameterMetadata,
  choices: ReadonlyArray<PrimitiveChoice>,
  split: TrialSplit,
  rolls: ReadonlyArray<number>,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<DimensionScoreTrace<PrimitiveChoice>, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const belowValues = primitiveValuesForParameter(parameter, split.below)
    const aboveValues = primitiveValuesForParameter(parameter, split.above)
    const belowDensity = yield* buildCategoricalParzen(Arr.fromIterable(choices), belowValues)
    const aboveDensity = yield* buildCategoricalParzen(Arr.fromIterable(choices), aboveValues)
    const candidates = sampleWeightedCategoricalCandidatesFromRolls(
      choices,
      belowDensity.probabilities,
      rolls
    )
    const scoredCandidates = candidates.map((candidate, index) => {
      const logL = logProbability(belowDensity.choices, belowDensity.probabilities, candidate)
      const logG = logProbability(aboveDensity.choices, aboveDensity.probabilities, candidate)

      return {
        logL,
        logG,
        score: scoreAcquisition({
          logL,
          logG,
          estimatedCost: Option.none(),
          roll: Arr.get(rolls, index)
        }, acquisition)
      }
    })

    return new DimensionScoreTrace({
      candidates,
      logL: scoredCandidates.map((candidate) => candidate.logL),
      logG: scoredCandidates.map((candidate) => candidate.logG),
      scores: scoredCandidates.map((candidate) => candidate.score)
    })
  })

/** @since 0.1.0 */
export const categoricalCandidateTrace = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  choices: ReadonlyArray<PrimitiveChoice>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<DimensionScoreTrace<PrimitiveChoice>, InvalidSamplerConfig> =>
  drawRolls(rng, nCandidates).pipe(
    Effect.flatMap((rolls) => categoricalCandidateTraceFromRolls(parameter, choices, split, rolls, acquisition))
  )

/** @since 0.1.0 */
export const suggestMultivariateCategorical = (
  rng: Rng.Rng,
  nCandidates: number,
  space: SearchSpace.SearchSpace,
  split: TrialSplit,
  dimensions: Array<Multi.CategoricalDimension>,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const tupleDomain = Multi.enumerateChoiceTuples(dimensions)
    const tupleChoices = tupleDomain.map((tupleConfig) => Multi.tupleKey(tupleConfig))
    const lookup = Multi.tupleLookup(tupleDomain)
    const belowKeys = yield* tupleKeysFromTrials(dimensions, split.below)
    const aboveKeys = yield* tupleKeysFromTrials(dimensions, split.above)
    const belowDensity = yield* buildCategoricalParzen(tupleChoices, belowKeys)
    const aboveDensity = yield* buildCategoricalParzen(tupleChoices, aboveKeys)
    const rolls = yield* drawRolls(rng, nCandidates)
    const candidates = sampleWeightedCategoricalCandidatesFromRolls(
      tupleChoices,
      belowDensity.probabilities,
      rolls
    )
    const scores = candidates.map((candidate, index) => {
      const logL = logProbability(belowDensity.choices, belowDensity.probabilities, candidate)
      const logG = logProbability(aboveDensity.choices, aboveDensity.probabilities, candidate)

      return scoreAcquisition({
        logL,
        logG,
        estimatedCost: Option.none(),
        roll: Arr.get(rolls, index)
      }, acquisition)
    })
    const bestCandidate = yield* chooseBestCandidate(
      candidates,
      scores,
      "tpe categorical candidate selection produced no candidate"
    )
    const bestKey = yield* Match.value(bestCandidate).pipe(
      Match.withReturnType<Effect.Effect<string, InvalidSamplerConfig>>(),
      Match.when(Match.string, (value) => Effect.succeed(value)),
      Match.orElse(() =>
        Effect.fail(invalidConfig("tpe categorical candidate selection must resolve to a string tuple key"))
      )
    )
    const bestTuple = yield* Option.fromNullable(lookup[bestKey]).pipe(
      Option.match({
        onNone: () => Effect.fail(invalidConfig("tpe categorical candidate key lookup failed")),
        onSome: Effect.succeed
      })
    )
    const raw = yield* Multi.configFromTuple(dimensions, bestTuple).pipe(
      Option.match({
        onNone: () => Effect.fail(invalidConfig("tpe categorical candidate tuple does not align with dimensions")),
        onSome: Effect.succeed
      })
    )

    return raw
  })
