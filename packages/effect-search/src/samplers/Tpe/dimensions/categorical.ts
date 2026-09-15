/**
 * TPE categorical dimension — Parzen-based density estimation and candidate sampling for categorical parameters.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option, Record, Schema } from "effect"

import { type PrimitiveChoice } from "../../../contracts/Distribution.js"
import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import type * as Rng from "../../../internal/rng.js"
import { sampleWeightedCategoricalCandidatesFromRolls } from "../../../internal/tpe/candidates.js"
import { buildCategoricalParzen } from "../../../internal/tpe/categoricalParzen.js"
import * as Multi from "../../../internal/tpe/multivariateCategorical.js"
import { type CompletedTrialForSplit, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import {
  AcquisitionContext,
  type AcquisitionOption,
  defaultAcquisitionName,
  scoreAcquisition
} from "../acquisition/index.js"
import { chooseBestCandidate, drawRolls } from "../candidates.js"
import { invalidConfig } from "../options.js"
import { logProbability } from "../scoring.js"
import { DimensionScoreTrace } from "./trace.js"
import { primitiveValuesForParameter } from "./values.js"

const MAX_JOINT_CATEGORICAL_TUPLES = 65_536

class CategoricalCandidateScore extends Schema.Class<CategoricalCandidateScore>(
  "effect-search/CategoricalCandidateScore"
)({
  logL: Schema.Number,
  logG: Schema.Number,
  score: Schema.Number
}) {}

const tupleKeyFromTrial = (
  dimensions: Multi.CategoricalDimensions,
  trial: CompletedTrialForSplit
): Effect.Effect<string, InvalidSamplerConfig> =>
  Multi.tupleFromConfig(dimensions, trial.config).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          invalidConfig(`tpe categorical history trial ${trial.trialNumber} does not match search-space dimensions`)
        ),
      onSome: (tupleConfig) =>
        Multi.tupleKey(tupleConfig).pipe(
          Effect.mapError(() => invalidConfig("tpe categorical history contains an unencodable choice"))
        )
    })
  )

const tupleKeysFromTrials = (
  dimensions: Multi.CategoricalDimensions,
  trials: TrialSplit["below"]
): Effect.Effect<Multi.ChoiceTupleKeys, InvalidSamplerConfig> =>
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
): Multi.CategoricalDimensions =>
  Arr.flatMap(space.params, (parameter) =>
    Match.value(parameter.distribution).pipe(
      Match.when({ type: "categorical" }, ({ choices }) =>
        Arr.of(
          new Multi.CategoricalDimension({
            name: parameter.name,
            choices: Arr.fromIterable(choices)
          })
        )),
      Match.when({ type: "float" }, () => Arr.empty<Multi.CategoricalDimension>()),
      Match.when({ type: "int" }, () => Arr.empty<Multi.CategoricalDimension>()),
      Match.when({ type: "fidelity" }, () => Arr.empty<Multi.CategoricalDimension>()),
      Match.exhaustive
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
  parameter: SearchSpace.ParameterMetadata,
  choices: Multi.CategoricalDimension["choices"],
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
  choices: Multi.CategoricalDimension["choices"],
  split: TrialSplit,
  rolls: DimensionScoreTrace<number>["scores"],
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
    const scoredCandidates = Arr.map(candidates, (candidate, index) => {
      const logL = logProbability(belowDensity.choices, belowDensity.probabilities, candidate)
      const logG = logProbability(aboveDensity.choices, aboveDensity.probabilities, candidate)

      return new CategoricalCandidateScore({
        logL,
        logG,
        score: scoreAcquisition(
          new AcquisitionContext({
            logL,
            logG,
            estimatedCost: Option.none(),
            roll: Arr.get(rolls, index)
          }),
          acquisition
        )
      })
    })

    return new DimensionScoreTrace({
      candidates,
      logL: Arr.map(scoredCandidates, (candidate) => candidate.logL),
      logG: Arr.map(scoredCandidates, (candidate) => candidate.logG),
      scores: Arr.map(scoredCandidates, (candidate) => candidate.score)
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
  choices: Multi.CategoricalDimension["choices"],
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<DimensionScoreTrace<PrimitiveChoice>, InvalidSamplerConfig> =>
  drawRolls(rng, nCandidates).pipe(
    Effect.flatMap((rolls) => categoricalCandidateTraceFromRolls(parameter, choices, split, rolls, acquisition))
  )

/**
 * Suggests a joint categorical assignment across multiple dimensions by
 * enumerating choice tuples and scoring via Parzen density.
 *
 * Flattens multi-dimensional categorical spaces into a single-dimension
 * tuple space so the density estimator captures inter-dimension correlations.
 * Products above 65,536 tuples fail before allocation; the candidate count
 * controls draws, not the size of this joint domain.
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
  dimensions: Multi.CategoricalDimensions,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const tupleCount = Arr.reduce(
      dimensions,
      1,
      (count, dimension) => Num.multiply(count, Arr.length(dimension.choices))
    )
    yield* Effect.succeed(tupleCount).pipe(
      Effect.filterOrFail(
        Num.lessThanOrEqualTo(MAX_JOINT_CATEGORICAL_TUPLES),
        () => invalidConfig("tpe joint categorical sampling supports at most 65536 tuples")
      )
    )
    const tupleDomain = Multi.enumerateChoiceTuples(dimensions)
    const tupleChoices = yield* Effect.forEach(tupleDomain, Multi.tupleKey).pipe(
      Effect.mapError(() => invalidConfig("tpe categorical search space contains an unencodable choice"))
    )
    const lookup = yield* Multi.tupleLookup(tupleDomain).pipe(
      Effect.mapError(() => invalidConfig("tpe categorical search space contains an unencodable choice"))
    )
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

      return scoreAcquisition(
        new AcquisitionContext({
          logL,
          logG,
          estimatedCost: Option.none(),
          roll: Arr.get(rolls, index)
        }),
        acquisition
      )
    })
    const bestCandidate = yield* chooseBestCandidate(
      candidates,
      scores,
      "tpe categorical candidate selection produced no candidate"
    )
    const bestKey = yield* Match.value(bestCandidate).pipe(
      Match.withReturnType<Effect.Effect<string, InvalidSamplerConfig>>(),
      Match.when(Match.string, (value) => Effect.succeed(value)),
      Match.when(
        Match.number,
        () => Effect.fail(invalidConfig("tpe categorical candidate selection must resolve to a string tuple key"))
      ),
      Match.when(
        Match.boolean,
        () => Effect.fail(invalidConfig("tpe categorical candidate selection must resolve to a string tuple key"))
      ),
      Match.when(
        null,
        () => Effect.fail(invalidConfig("tpe categorical candidate selection must resolve to a string tuple key"))
      ),
      Match.exhaustive
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
