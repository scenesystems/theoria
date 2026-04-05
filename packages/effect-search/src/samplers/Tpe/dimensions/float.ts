/**
 * TPE float dimension — continuous Parzen estimation with log-scale and step-quantization support.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Tuple } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import * as Float64 from "../../../internal/float64.js"
import type * as Rng from "../../../internal/rng.js"
import { buildContinuousParzen, logDensity, sampleFromParzen } from "../../../internal/tpe/continuousParzen.js"
import { defaultNoiseBandwidthOptions, type NoiseBandwidthOptions } from "../../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreAcquisition } from "../acquisition/index.js"
import { chooseBestCandidate, drawRollPairs } from "../candidates.js"
import { objectiveVarianceFromSplit } from "../costModel.js"
import { invalidConfig } from "../options.js"
import type { PreparedTpeParameterObservations } from "../preparedModel.js"
import { rollFromCandidatePair } from "./rolls.js"
import { type CandidateRollPair, DimensionScoreTrace } from "./trace.js"
import { numericValuesForParameter } from "./values.js"

class FloatModel extends Data.Class<{
  readonly low: number
  readonly high: number
  readonly toModel: (value: number) => number
  readonly fromModel: (value: number) => number
}> {}

const quantizeWithStep = (
  value: number,
  low: number,
  high: number,
  step: number
): number =>
  Num.clamp(low + Num.round(Num.unsafeDivide(value - low, step), 0) * step, {
    minimum: low,
    maximum: high
  })

/**
 * Clamps and optionally step-quantizes a raw float sample back into the
 * original parameter domain.
 *
 * When a step size is provided, values are rounded to the nearest valid grid
 * point within [low, high]. Without a step, values are simply clamped.
 *
 * @see {@link expandedBoundsForStep} for the companion bound expansion
 * @since 0.1.0
 * @category constructors
 */
export const normalizeFloat = (
  value: number,
  low: number,
  high: number,
  step: Option.Option<number>
): number =>
  Option.match(step, {
    onNone: () => Num.clamp(value, { minimum: low, maximum: high }),
    onSome: (stride) => quantizeWithStep(value, low, high, stride)
  })

/**
 * Expands parameter bounds by half a step in each direction so the Parzen
 * estimator covers the full quantized range.
 *
 * Without expansion, the boundary kernels would undercount edge values,
 * biasing the density estimate away from the parameter limits.
 *
 * @see {@link normalizeFloat} for the clamping step that uses these bounds
 * @since 0.1.0
 * @category constructors
 */
export const expandedBoundsForStep = (
  low: number,
  high: number,
  step: Option.Option<number>
): readonly [number, number] =>
  Option.match(step, {
    onNone: () => Tuple.make(low, high),
    onSome: (stride) => Tuple.make(low - Num.unsafeDivide(stride, 2), high + Num.unsafeDivide(stride, 2))
  })

const floatModel = (
  name: string,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>
): Effect.Effect<FloatModel, InvalidSamplerConfig> =>
  Option.match(scale, {
    onNone: () =>
      Effect.sync(() => {
        const [expandedLow, expandedHigh] = expandedBoundsForStep(low, high, step)

        return new FloatModel({
          low: expandedLow,
          high: expandedHigh,
          toModel: (value: number) => value,
          fromModel: (value: number) => value
        })
      }),
    onSome: (s) =>
      Match.value(s).pipe(
        Match.when("log", () =>
          Match.value(Num.lessThanOrEqualTo(low, 0) || Num.lessThanOrEqualTo(high, 0)).pipe(
            Match.when(
              true,
              () => Effect.fail(invalidConfig(`tpe log-scaled float dimension "${name}" requires low > 0 and high > 0`))
            ),
            Match.orElse(() =>
              Effect.succeed(
                new FloatModel({
                  low: Float64.log(low),
                  high: Float64.log(high),
                  toModel: (value: number) => Float64.log(value),
                  fromModel: (value: number) => Float64.exp(value)
                })
              )
            )
          )),
        Match.orElse(() =>
          Effect.sync(() => {
            const [expandedLow, expandedHigh] = expandedBoundsForStep(low, high, step)

            return new FloatModel({
              low: expandedLow,
              high: expandedHigh,
              toModel: (value: number) => value,
              fromModel: (value: number) => value
            })
          })
        )
      )
  })

/**
 * Suggests the best float value for a parameter by building Parzen estimators
 * on the below/above splits, sampling candidates from the below-distribution,
 * and selecting the highest-scoring one via the acquisition function.
 *
 * @see {@link floatCandidateTrace} for the underlying trace construction
 * @see {@link normalizeFloat} for the domain clamping applied to candidates
 * @since 0.1.0
 * @category sampling
 */
export const suggestFloatParameter = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const trace = yield* floatCandidateTrace(
      rng,
      nCandidates,
      parameter,
      low,
      high,
      scale,
      step,
      split,
      noiseOptions,
      acquisition,
      preparedObservations
    )

    return yield* chooseBestCandidate(
      trace.candidates,
      trace.scores,
      `tpe float candidate selection produced no candidate for parameter "${parameter.name}"`
    )
  })

/**
 * Builds a full candidate trace for a float parameter from pre-drawn rolls,
 * including log-scale transform and noise-bandwidth support.
 *
 * Separates randomness (rolls) from density estimation so traces can be
 * replayed deterministically from a checkpoint.
 *
 * @see {@link floatCandidateTrace} for the convenience wrapper that draws rolls
 * @see {@link DimensionScoreTrace} for the output shape
 * @since 0.1.0
 * @category sampling
 */
export const floatCandidateTraceFromRolls = (
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>,
  split: TrialSplit,
  rolls: ReadonlyArray<CandidateRollPair>,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const model = yield* floatModel(parameter.name, low, high, scale, step)
    const empiricalVariance = objectiveVarianceFromSplit(split)
    const belowValues = Option.match(preparedObservations, {
      onNone: () => numericValuesForParameter(parameter, split.below),
      onSome: (observations) => observations.belowNumeric
    })
    const aboveValues = Option.match(preparedObservations, {
      onNone: () => numericValuesForParameter(parameter, split.above),
      onSome: (observations) => observations.aboveNumeric
    })
    const belowParzen = buildContinuousParzen(
      Arr.map(belowValues, model.toModel),
      model.low,
      model.high,
      noiseOptions,
      empiricalVariance
    )
    const aboveParzen = buildContinuousParzen(
      Arr.map(aboveValues, model.toModel),
      model.low,
      model.high,
      noiseOptions,
      empiricalVariance
    )
    const modelCandidates = Arr.map(rolls, ([kernelRoll, valueRoll]) =>
      sampleFromParzen(belowParzen, kernelRoll, valueRoll))
    const logPairs = Arr.map(modelCandidates, (candidate) =>
      Tuple.make(logDensity(belowParzen, candidate), logDensity(aboveParzen, candidate)))

    return new DimensionScoreTrace({
      candidates: Arr.map(modelCandidates, (candidate) =>
        normalizeFloat(model.fromModel(candidate), low, high, step)),
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
 * Draws random roll pairs and delegates to {@link floatCandidateTraceFromRolls}
 * to produce a complete float dimension trace.
 *
 * This is the primary entry point for float dimension tracing in the
 * mixed-space suggestion pipeline.
 *
 * @see {@link floatCandidateTraceFromRolls} for the roll-based implementation
 * @see {@link suggestFloatParameter} for direct best-value selection
 * @since 0.1.0
 * @category sampling
 */
export const floatCandidateTrace = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedObservations: Option.Option<PreparedTpeParameterObservations> = Option.none()
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  drawRollPairs(rng, nCandidates).pipe(
    Effect.flatMap((rolls) =>
      floatCandidateTraceFromRolls(
        parameter,
        low,
        high,
        scale,
        step,
        split,
        rolls,
        noiseOptions,
        acquisition,
        preparedObservations
      )
    )
  )
