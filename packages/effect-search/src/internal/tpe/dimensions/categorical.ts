/**
 * TPE categorical dimension — Parzen-based density estimation and candidate sampling for categorical parameters.
 *
 * @since 0.1.0
 */
import { Array as Arr, Chunk, Effect, Match, Option, Record } from "effect"

import * as Acquisition from "../../../Acquisition.js"
import { type Choice } from "../../../Distribution.js"
import type * as Rng from "../../../internal/rng.js"
import { sampleWeightedCategoricalCandidatesFromRolls } from "../../../internal/tpe/candidates.js"
import { buildCategoricalParzen } from "../../../internal/tpe/categoricalParzen.js"
import * as Multi from "../../../internal/tpe/multivariateCategorical.js"
import { type CompletedTrialForSplit, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { InvalidSamplerConfig } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import { chooseBestCandidate, drawRolls } from "../candidateSelection.js"
import { invalidConfig } from "../options.js"
import { logProbability } from "../scoring.js"
import { DimensionScoreTrace } from "./trace.js"
import { primitiveValuesForParameter } from "./values.js"

const tupleKeyFromTrial = (
  dimensionsInput: Iterable<Multi.CategoricalDimension>,
  trial: CompletedTrialForSplit
): Effect.Effect<string, InvalidSamplerConfig> => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  return Multi.tupleFromConfig(dimensions, trial.config).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          invalidConfig(`tpe categorical history trial ${trial.trialNumber} does not match search-space dimensions`)
        ),
      onSome: (tupleConfig) => Effect.succeed(Multi.tupleKey(tupleConfig))
    })
  )
}

const tupleKeysFromTrials = (
  dimensionsInput: Iterable<Multi.CategoricalDimension>,
  trialsInput: Iterable<CompletedTrialForSplit>
) => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  const trials = Arr.fromIterable(trialsInput)
  return Effect.forEach(trials, (trial) => tupleKeyFromTrial(dimensions, trial))
}

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
  return Effect.gen(function*() {
    const trace = yield* categoricalCandidateTrace(rng, nCandidates, parameter, choices, split, acquisition)

    return yield* chooseBestCandidate(
      trace.candidates,
      trace.scores,
      `tpe categorical candidate selection produced no candidate for parameter "${parameter.name}"`
    )
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
  rollsInput: Iterable<number>,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<DimensionScoreTrace<Choice>, InvalidSamplerConfig> => {
  const choices = Arr.fromIterable(choicesInput)
  const rolls = Arr.fromIterable(rollsInput)
  return Effect.gen(function*() {
    const belowValues = primitiveValuesForParameter(parameter, split.below)
    const aboveValues = primitiveValuesForParameter(parameter, split.above)
    const belowDensity = yield* buildCategoricalParzen(choices, belowValues)
    const aboveDensity = yield* buildCategoricalParzen(choices, aboveValues)
    const candidates = sampleWeightedCategoricalCandidatesFromRolls(
      choices,
      belowDensity.probabilities,
      rolls
    )
    const scoredCandidates = Arr.map(candidates, (candidate, index) => {
      const logL = logProbability(belowDensity.choices, belowDensity.probabilities, candidate)
      const logG = logProbability(aboveDensity.choices, aboveDensity.probabilities, candidate)

      return {
        logL,
        logG,
        score: Acquisition.score({
          logL,
          logG,
          estimatedCost: Option.none(),
          roll: Arr.get(rolls, index)
        }, acquisition)
      }
    })

    return new DimensionScoreTrace({
      candidates: Chunk.fromIterable(candidates),
      logL: Arr.map(scoredCandidates, (candidate) => candidate.logL),
      logG: Arr.map(scoredCandidates, (candidate) => candidate.logG),
      scores: Arr.map(scoredCandidates, (candidate) => candidate.score)
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
  return drawRolls(rng, nCandidates).pipe(
    Effect.flatMap((rolls) => categoricalCandidateTraceFromRolls(parameter, choices, split, rolls, acquisition))
  )
}

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
  dimensionsInput: Iterable<Multi.CategoricalDimension>,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<unknown, InvalidSamplerConfig> => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  return Effect.gen(function*() {
    const tupleDomain = Multi.enumerateChoiceTuples(dimensions)
    const tupleChoices = Arr.map(tupleDomain, (tupleConfig) => Multi.tupleKey(tupleConfig))
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
    const scores = Arr.map(candidates, (candidate, index) => {
      const logL = logProbability(belowDensity.choices, belowDensity.probabilities, candidate)
      const logG = logProbability(aboveDensity.choices, aboveDensity.probabilities, candidate)

      return Acquisition.score({
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
    const bestTuple = yield* Record.get(lookup, bestKey).pipe(
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
}
