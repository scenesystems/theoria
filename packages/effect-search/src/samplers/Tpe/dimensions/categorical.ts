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
import type { PreparedTpeParameterObservations } from "../preparedModel.js"
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
  parameter: SearchSpace.ParameterMetadata,
  choices: ReadonlyArray<PrimitiveChoice>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<PrimitiveChoice, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const trace = yield* categoricalCandidateTrace(
      rng,
      nCandidates,
      parameter,
      choices,
      split,
      acquisition,
      preparedObservations
    )

    return yield* chooseBestCandidate(
      trace.candidates,
      trace.scores,
      `tpe categorical candidate selection produced no candidate for parameter "${parameter.name}"`
    )
  })

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
  parameter: SearchSpace.ParameterMetadata,
  choices: ReadonlyArray<PrimitiveChoice>,
  split: TrialSplit,
  rolls: ReadonlyArray<number>,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<DimensionScoreTrace<PrimitiveChoice>, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const belowValues = Option.match(preparedObservations, {
      onNone: () => primitiveValuesForParameter(parameter, split.below),
      onSome: (observations) => observations.belowPrimitive
    })
    const aboveValues = Option.match(preparedObservations, {
      onNone: () => primitiveValuesForParameter(parameter, split.above),
      onSome: (observations) => observations.abovePrimitive
    })
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
  parameter: SearchSpace.ParameterMetadata,
  choices: ReadonlyArray<PrimitiveChoice>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<DimensionScoreTrace<PrimitiveChoice>, InvalidSamplerConfig> =>
  drawRolls(rng, nCandidates).pipe(
    Effect.flatMap((rolls) =>
      categoricalCandidateTraceFromRolls(parameter, choices, split, rolls, acquisition, preparedObservations)
    )
  )

/**
 * Suggests a joint categorical assignment across multiple dimensions by
 * enumerating choice tuples and scoring via Parzen density.
 *
 * Flattens multi-dimensional categorical spaces into a single-dimension
 * tuple space so the density estimator captures inter-dimension correlations.
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
