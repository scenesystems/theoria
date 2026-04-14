/**
 * Statistical power-analysis kernels for standardized mean differences.
 *
 * Statistics owns the released report envelopes while Distribution owns the
 * noncentral Student's t-distribution and Optimization owns the Brent-based
 * inversion kernel reused for sample-size solving.
 *
 * @since 0.3.0
 * @category internal
 */
import { Match, Number as N, Option } from "effect"

import { noncentralTCdf, studentTQuantile } from "../../Distribution/operations.js"
import { abs, sqrt } from "../../Numeric/operations.js"
import { brent } from "../../Optimization/operations.js"
import { RootFindingResult } from "../../Optimization/schema.js"
import type { HypothesisAlternativeType } from "../schema.js"
import { PowerAnalysisReport, SampleSizeForTargetPowerReport } from "../schema.js"

const DEFAULT_ALPHA = 0.05
const DEFAULT_MAX_SAMPLE_SIZE = 4096
const MIN_SAMPLE_SIZE = 2
const OPEN_INTERVAL_EPSILON = 1e-12
const EFFECT_SIZE_ZERO_TOLERANCE = 1e-12

type PowerAnalysisOptions = Readonly<{
  readonly alpha?: number
  readonly alternative?: HypothesisAlternativeType
}>

type SampleSizeForTargetPowerOptions =
  & Readonly<{
    readonly maxSampleSize?: number
  }>
  & PowerAnalysisOptions

const clampOpenUnitInterval = (value: number): number =>
  N.max(OPEN_INTERVAL_EPSILON, N.min(N.subtract(1, OPEN_INTERVAL_EPSILON), value))

const defaultAlternative = (alternative?: HypothesisAlternativeType): HypothesisAlternativeType =>
  Option.getOrElse(Option.fromNullable(alternative), () => "twoSided")

const defaultAlpha = (alpha?: number): number => Option.getOrElse(Option.fromNullable(alpha), () => DEFAULT_ALPHA)

const defaultMaxSampleSize = (maxSampleSize?: number): number =>
  Option.getOrElse(Option.fromNullable(maxSampleSize), () => DEFAULT_MAX_SAMPLE_SIZE)

const degreesOfFreedom = (sampleSize: number): number => N.subtract(N.multiply(2, sampleSize), 2)

const noncentrality = (effectSize: number, sampleSize: number): number =>
  N.multiply(effectSize, sqrt(N.unsafeDivide(sampleSize, 2)))

const criticalValue = (alpha: number, df: number, alternative: HypothesisAlternativeType): number =>
  Match.value(alternative).pipe(
    Match.when("twoSided", () => studentTQuantile(N.subtract(1, N.unsafeDivide(alpha, 2)), df)),
    Match.when("greater", () => studentTQuantile(N.subtract(1, alpha), df)),
    Match.when("less", () => studentTQuantile(alpha, df)),
    Match.exhaustive
  )

const powerAt = (
  effectSize: number,
  sampleSize: number,
  alpha: number,
  alternative: HypothesisAlternativeType
): number => {
  const df = degreesOfFreedom(sampleSize)
  const boundary = criticalValue(alpha, df, alternative)
  const delta = noncentrality(effectSize, sampleSize)

  return clampOpenUnitInterval(
    Match.value(alternative).pipe(
      Match.when("twoSided", () =>
        N.sum(
          noncentralTCdf(N.multiply(-1, boundary), df, delta),
          N.subtract(1, noncentralTCdf(boundary, df, delta))
        )),
      Match.when("greater", () => N.subtract(1, noncentralTCdf(boundary, df, delta))),
      Match.when("less", () => noncentralTCdf(boundary, df, delta)),
      Match.exhaustive
    )
  )
}

const sampleSizeSolver = (
  effectSize: number,
  targetPower: number,
  alpha: number,
  alternative: HypothesisAlternativeType,
  maxSampleSize: number
) => {
  const lowerGap = N.subtract(powerAt(effectSize, MIN_SAMPLE_SIZE, alpha, alternative), targetPower)
  const upperGap = N.subtract(powerAt(effectSize, maxSampleSize, alpha, alternative), targetPower)

  if (lowerGap >= 0) {
    return new RootFindingResult({
      method: "brent",
      status: "converged",
      root: MIN_SAMPLE_SIZE,
      residual: abs(lowerGap),
      iterationCount: 0,
      functionEvaluationCount: 1
    })
  }

  if (N.lessThanOrEqualTo(abs(effectSize), EFFECT_SIZE_ZERO_TOLERANCE) || upperGap < 0) {
    return new RootFindingResult({
      method: "brent",
      status: "maxIterationsExceeded",
      root: maxSampleSize,
      residual: abs(upperGap),
      iterationCount: 0,
      functionEvaluationCount: 2
    })
  }

  return brent(
    (candidateSampleSize) => N.subtract(powerAt(effectSize, candidateSampleSize, alpha, alternative), targetPower),
    MIN_SAMPLE_SIZE,
    maxSampleSize,
    {
      absoluteTolerance: 1e-6,
      relativeTolerance: 1e-6,
      maxIterations: 128
    }
  )
}

/**
 * Statistical power for an equal-group standardized mean-difference test.
 *
 * @since 0.3.0
 * @category internal
 */
export const powerForMeanDifference = (
  effectSize: number,
  sampleSize: number,
  options?: PowerAnalysisOptions
): PowerAnalysisReport => {
  const alpha = defaultAlpha(options?.alpha)
  const alternative = defaultAlternative(options?.alternative)
  const df = degreesOfFreedom(sampleSize)
  const critical = criticalValue(alpha, df, alternative)
  const delta = noncentrality(effectSize, sampleSize)

  return new PowerAnalysisReport({
    effectSize,
    sampleSize,
    alpha,
    alternative,
    degreesOfFreedom: df,
    criticalValue: critical,
    noncentrality: delta,
    power: powerAt(effectSize, sampleSize, alpha, alternative)
  })
}

/**
 * Sample-size inversion for an equal-group standardized mean-difference test.
 *
 * @since 0.3.0
 * @category internal
 */
export const sampleSizeForTargetPower = (
  effectSize: number,
  targetPower: number,
  options?: SampleSizeForTargetPowerOptions
): SampleSizeForTargetPowerReport => {
  const alpha = defaultAlpha(options?.alpha)
  const alternative = defaultAlternative(options?.alternative)
  const maxSampleSize = defaultMaxSampleSize(options?.maxSampleSize)
  const solver = sampleSizeSolver(effectSize, targetPower, alpha, alternative, maxSampleSize)
  const sampleSize = N.max(MIN_SAMPLE_SIZE, Math.ceil(solver.root))
  const achievedPower = powerForMeanDifference(effectSize, sampleSize, { alpha, alternative })

  return new SampleSizeForTargetPowerReport({
    effectSize,
    targetPower,
    alpha,
    alternative,
    sampleSize,
    achievedPower: achievedPower.power,
    solver
  })
}
