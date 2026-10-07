/**
 * TPE float dimension — continuous Parzen estimation with log-scale and step-quantization support.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Chunk, Data, Effect, Match, Number as Num, Option, Tuple } from "effect"

import { logStrict, logSumExp } from "@scenesystems/effect-math/Numeric"
import * as Acquisition from "../../../Acquisition.js"
import { exp } from "../../../internal/exponential.js"
import type * as Rng from "../../../internal/rng.js"
import { buildContinuousParzen, sampleFromParzen } from "../../../internal/tpe/continuousParzen.js"
import {
  prepareKernelLogDensity,
  prepareKernelLogMass,
  prepareLogDensity
} from "../../../internal/tpe/continuousParzen/density.js"
import { defaultNoiseBandwidthOptions, type NoiseBandwidthOptions } from "../../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { InvalidSamplerConfig } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import { chooseBestCandidate, drawRollPairs } from "../candidateSelection.js"
import { objectiveVarianceFromSplit } from "../costModel.js"
import { invalidConfig } from "../options.js"
import { rollFromCandidatePair } from "./rolls.js"
import { type CandidateRollPair, DimensionScoreTrace } from "./trace.js"
import { numericValuesForParameter, weightedNumericValuesForParameter } from "./values.js"

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
  Num.clamp(Num.sum(low, Num.multiply(Num.round(Num.divideUnsafe(Num.subtract(value, low), step), 0), step)), {
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
    onSome: (stride) =>
      Tuple.make(Num.subtract(low, Num.divideUnsafe(stride, 2)), Num.sum(high, Num.divideUnsafe(stride, 2)))
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
          Match.value(Bool.or(Num.isLessThanOrEqualTo(low, 0), Num.isLessThanOrEqualTo(high, 0))).pipe(
            Match.when(
              true,
              () => Effect.fail(invalidConfig(`tpe log-scaled float dimension "${name}" requires low > 0 and high > 0`))
            ),
            Match.orElse(() =>
              Effect.succeed(
                new FloatModel({
                  low: logStrict(low),
                  high: logStrict(high),
                  toModel: (value: number) => logStrict(value),
                  fromModel: (value: number) => exp(value)
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
              toModel: (value: number) =>
                value,
              fromModel: (value: number) => value
            })
          })
        )
      )
  })

class ScoredCandidates extends Data.Class<{
  readonly logPairs: ReadonlyArray<readonly [number, number]>
  readonly kernelLogL: ReadonlyArray<ReadonlyArray<number>>
  readonly kernelLogG: ReadonlyArray<ReadonlyArray<number>>
}> {}

/**
 * Linear stepped floats are Optuna `_BatchedDiscreteTruncNormDistributions`: candidates are quantized
 * before scoring, and each kernel scores the probability mass of the candidate's grid cell.
 */
const gridCellStep = (scale: Option.Option<"linear" | "log">, step: Option.Option<number>): Option.Option<number> =>
  Option.filter(step, () => Bool.not(Option.contains(scale, "log")))

const mixtureLogMass = (scores: ReadonlyArray<number>, weights: ReadonlyArray<number>): number =>
  logSumExp(Chunk.fromIterable(Arr.zipWith(scores, weights, (score, weight) => Num.sum(score, logStrict(weight)))))

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
  parameter: SearchSpace.Parameter,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
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
  parameter: SearchSpace.Parameter,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>,
  split: TrialSplit,
  rollsInput: Iterable<CandidateRollPair>,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> => {
  const rolls = Arr.fromIterable(rollsInput)
  return Effect.gen(function*() {
    const model = yield* floatModel(parameter.name, low, high, scale, step)
    const empiricalVariance = objectiveVarianceFromSplit(split)
    const below = weightedNumericValuesForParameter(parameter, split.below)
    const belowParzen = buildContinuousParzen(
      Arr.map(below.values, model.toModel),
      model.low,
      model.high,
      noiseOptions,
      empiricalVariance,
      below.weights
    )
    const aboveParzen = buildContinuousParzen(
      Arr.map(numericValuesForParameter(parameter, split.above), model.toModel),
      model.low,
      model.high,
      noiseOptions,
      empiricalVariance
    )
    const modelCandidates = Arr.map(
      rolls,
      ([kernelRoll, valueRoll]) => sampleFromParzen(belowParzen, kernelRoll, valueRoll)
    )
    const candidates = Arr.map(
      modelCandidates,
      (candidate) => normalizeFloat(model.fromModel(candidate), low, high, step)
    )
    const weightsL = Arr.map(belowParzen.kernels, (kernel) => kernel.weight)
    const weightsG = Arr.map(aboveParzen.kernels, (kernel) => kernel.weight)
    const scored = Option.match(gridCellStep(scale, step), {
      onNone: () => {
        const belowLogDensity = prepareLogDensity(belowParzen)
        const aboveLogDensity = prepareLogDensity(aboveParzen)
        return new ScoredCandidates({
          logPairs: Arr.map(
            modelCandidates,
            (candidate) => Tuple.make(belowLogDensity(candidate), aboveLogDensity(candidate))
          ),
          kernelLogL: Arr.map(modelCandidates, prepareKernelLogDensity(belowParzen)),
          kernelLogG: Arr.map(modelCandidates, prepareKernelLogDensity(aboveParzen))
        })
      },
      onSome: (stride) => {
        const kernelLogL = Arr.map(candidates, prepareKernelLogMass(belowParzen, stride))
        const kernelLogG = Arr.map(candidates, prepareKernelLogMass(aboveParzen, stride))
        return new ScoredCandidates({
          logPairs: Arr.zipWith(
            kernelLogL,
            kernelLogG,
            (l, g) => Tuple.make(mixtureLogMass(l, weightsL), mixtureLogMass(g, weightsG))
          ),
          kernelLogL,
          kernelLogG
        })
      }
    })
    const logPairs = scored.logPairs

    return new DimensionScoreTrace({
      candidates: Chunk.fromIterable(candidates),
      logL: Arr.map(logPairs, ([logL]) => logL),
      logG: Arr.map(logPairs, ([_logL, logG]) => logG),
      kernelLogL: scored.kernelLogL,
      kernelLogG: scored.kernelLogG,
      weightsL,
      weightsG,
      scores: Arr.map(logPairs, ([logL, logG], index) =>
        Acquisition.score(
          new Acquisition.Context({
            logL,
            logG,
            estimatedCost: Option.none(),
            roll: rollFromCandidatePair(rolls, index)
          }),
          acquisition
        ))
    })
  })
}

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
  parameter: SearchSpace.Parameter,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  drawRollPairs(rng, nCandidates).pipe(
    Effect.flatMap((rolls) =>
      floatCandidateTraceFromRolls(parameter, low, high, scale, step, split, rolls, noiseOptions, acquisition)
    )
  )
