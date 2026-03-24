/**
 * TPE float dimension — continuous Parzen estimation with log-scale and step-quantization support.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Tuple } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import * as Float64 from "../../../internal/float64.js"
import type * as Rng from "../../../internal/rng.js"
import {
  buildContinuousParzen,
  logDensityEffect,
  sampleFromParzenEffect
} from "../../../internal/tpe/continuousParzen.js"
import { defaultNoiseBandwidthOptions, type NoiseBandwidthOptions } from "../../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreAcquisition } from "../acquisition/index.js"
import { chooseBestCandidate, drawRollPairs } from "../candidates.js"
import { objectiveVarianceFromSplit } from "../costModel.js"
import { invalidConfig } from "../options.js"
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

/** @since 0.1.0 */
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

/** @since 0.1.0 */
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

/** @since 0.1.0 */
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
  acquisition: AcquisitionOption = defaultAcquisitionName
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
      acquisition
    )

    return yield* chooseBestCandidate(
      trace.candidates,
      trace.scores,
      `tpe float candidate selection produced no candidate for parameter "${parameter.name}"`
    )
  })

/** @since 0.1.0 */
export const floatCandidateTraceFromRolls = (
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>,
  split: TrialSplit,
  rolls: ReadonlyArray<CandidateRollPair>,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const model = yield* floatModel(parameter.name, low, high, scale, step)
    const empiricalVariance = objectiveVarianceFromSplit(split)
    const belowParzen = buildContinuousParzen(
      numericValuesForParameter(parameter, split.below).map(model.toModel),
      model.low,
      model.high,
      noiseOptions,
      empiricalVariance
    )
    const aboveParzen = buildContinuousParzen(
      numericValuesForParameter(parameter, split.above).map(model.toModel),
      model.low,
      model.high,
      noiseOptions,
      empiricalVariance
    )
    const modelCandidates = yield* Effect.forEach(rolls, ([kernelRoll, valueRoll]) =>
      sampleFromParzenEffect(belowParzen, kernelRoll, valueRoll))
    const logPairs = yield* Effect.forEach(modelCandidates, (candidate) =>
      Effect.all([logDensityEffect(belowParzen, candidate), logDensityEffect(aboveParzen, candidate)]))

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

/** @since 0.1.0 */
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
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  drawRollPairs(rng, nCandidates).pipe(
    Effect.flatMap((rolls) =>
      floatCandidateTraceFromRolls(parameter, low, high, scale, step, split, rolls, noiseOptions, acquisition)
    )
  )
