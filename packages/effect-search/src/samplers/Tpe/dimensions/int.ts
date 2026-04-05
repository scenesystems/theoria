/**
 * TPE integer dimension — continuous Parzen estimation with integer rounding and step quantization.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Number as Num, Option, Tuple } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import type * as Rng from "../../../internal/rng.js"
import { buildContinuousParzen, logDensity, sampleFromParzen } from "../../../internal/tpe/continuousParzen.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreAcquisition } from "../acquisition/index.js"
import { chooseBestCandidate, drawRollPairs } from "../candidates.js"
import type { PreparedTpeParameterObservations } from "../preparedModel.js"
import { expandedBoundsForStep, normalizeFloat } from "./float.js"
import { rollFromCandidatePair } from "./rolls.js"
import { type CandidateRollPair, DimensionScoreTrace } from "./trace.js"
import { numericValuesForParameter } from "./values.js"

const normalizeInt = (
  value: number,
  low: number,
  high: number,
  step: Option.Option<number>
): number =>
  Num.round(
    normalizeFloat(value, low, high, Option.orElse(step, () => Option.some(1))),
    0
  )

/**
 * Suggests the best integer value for a parameter by sampling candidates from
 * the below-distribution Parzen estimator, scoring them via acquisition, and
 * rounding to the nearest valid step.
 *
 * @see {@link intCandidateTrace} for the underlying trace construction
 * @see {@link suggestFloatParameter} for the continuous-valued equivalent
 * @since 0.1.0
 * @category sampling
 */
export const suggestIntParameter = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  step: Option.Option<number>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const trace = yield* intCandidateTrace(
      rng,
      nCandidates,
      parameter,
      low,
      high,
      step,
      split,
      acquisition,
      preparedObservations
    )

    return yield* chooseBestCandidate(
      trace.candidates,
      trace.scores,
      `tpe int candidate selection produced no candidate for parameter "${parameter.name}"`
    )
  })

/**
 * Builds a full candidate trace for an integer parameter from pre-drawn rolls,
 * returning candidates, log-densities, and acquisition scores.
 *
 * Internally uses expanded bounds (±0.5 step) so the Parzen estimator covers
 * the full integer range including boundary values.
 *
 * @see {@link intCandidateTrace} for the convenience wrapper that draws rolls
 * @see {@link DimensionScoreTrace} for the output shape
 * @since 0.1.0
 * @category sampling
 */
export const intCandidateTraceFromRolls = (
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  step: Option.Option<number>,
  split: TrialSplit,
  rolls: ReadonlyArray<CandidateRollPair>,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const stride = Option.getOrElse(step, () => 1)
    const [modelLow, modelHigh] = expandedBoundsForStep(low, high, Option.some(stride))
    const belowValues = Option.match(preparedObservations, {
      onNone: () => numericValuesForParameter(parameter, split.below),
      onSome: (observations) => observations.belowNumeric
    })
    const aboveValues = Option.match(preparedObservations, {
      onNone: () => numericValuesForParameter(parameter, split.above),
      onSome: (observations) => observations.aboveNumeric
    })

    const belowParzen = buildContinuousParzen(belowValues, modelLow, modelHigh)
    const aboveParzen = buildContinuousParzen(aboveValues, modelLow, modelHigh)
    const modelCandidates = Arr.map(rolls, ([kernelRoll, valueRoll]) =>
      sampleFromParzen(belowParzen, kernelRoll, valueRoll))
    const logPairs = Arr.map(modelCandidates, (candidate) =>
      Tuple.make(logDensity(belowParzen, candidate), logDensity(aboveParzen, candidate)))

    return new DimensionScoreTrace({
      candidates: Arr.map(modelCandidates, (candidate) =>
        normalizeInt(candidate, low, high, step)),
      logL: Arr.map(logPairs, ([logL]) =>
        logL),
      logG: Arr.map(logPairs, ([_logL, logG]) =>
        logG),
      scores: Arr.map(logPairs, ([logL, logG], index) =>
        scoreAcquisition({
          logL,
          logG,
          estimatedCost: Option.none(),
          roll: rollFromCandidatePair(rolls, index)
        }, acquisition))
    })
  })

/**
 * Draws random roll pairs and delegates to {@link intCandidateTraceFromRolls}
 * to produce a complete integer dimension trace.
 *
 * This is the primary entry point for integer dimension tracing in the
 * mixed-space suggestion pipeline.
 *
 * @see {@link intCandidateTraceFromRolls} for the roll-based implementation
 * @see {@link suggestIntParameter} for direct best-value selection
 * @since 0.1.0
 * @category sampling
 */
export const intCandidateTrace = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  step: Option.Option<number>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  drawRollPairs(rng, nCandidates).pipe(
    Effect.flatMap((rolls) =>
      intCandidateTraceFromRolls(parameter, low, high, step, split, rolls, acquisition, preparedObservations)
    )
  )
