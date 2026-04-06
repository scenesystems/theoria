/**
 * Statistical inference kernels for mean estimation and t-tests.
 *
 * Statistics owns the released report envelopes while Distribution owns the
 * underlying central t-distribution authority used to compute tail areas and
 * critical values.
 *
 * @since 0.3.0
 * @category internal
 */
import { Chunk, Match, Number as N, Option } from "effect"

import { studentTCdf, studentTQuantile } from "../../Distribution/operations.js"
import { sqrt } from "../../Numeric/operations.js"
import type { HypothesisAlternativeType } from "../schema.js"
import { ConfidenceInterval, MeanConfidenceIntervalReport, TTestReport } from "../schema.js"
import * as Estimators from "./estimators.js"

const DEFAULT_ALPHA = 0.05
const DEFAULT_CONFIDENCE_LEVEL = 0.95
const OPEN_INTERVAL_EPSILON = 1e-12

type MeanConfidenceIntervalOptions = Readonly<{
  readonly confidenceLevel?: number
  readonly alternative?: HypothesisAlternativeType
}>

type TTestOptions = Readonly<{
  readonly nullValue?: number
  readonly alpha?: number
  readonly alternative?: HypothesisAlternativeType
}>

const defaultAlternative = (alternative?: HypothesisAlternativeType): HypothesisAlternativeType =>
  Option.getOrElse(Option.fromNullable(alternative), () => "twoSided")

const defaultConfidenceLevel = (confidenceLevel?: number): number =>
  Option.getOrElse(Option.fromNullable(confidenceLevel), () => DEFAULT_CONFIDENCE_LEVEL)

const defaultAlpha = (alpha?: number): number => Option.getOrElse(Option.fromNullable(alpha), () => DEFAULT_ALPHA)

const clampOpenUnitInterval = (value: number): number =>
  N.max(OPEN_INTERVAL_EPSILON, N.min(N.subtract(1, OPEN_INTERVAL_EPSILON), value))

const criticalValue = (
  confidenceLevel: number,
  degreesOfFreedom: number,
  alternative: HypothesisAlternativeType
): number =>
  Match.value(alternative).pipe(
    Match.when("twoSided", () =>
      studentTQuantile(N.subtract(1, N.unsafeDivide(N.subtract(1, confidenceLevel), 2)), degreesOfFreedom)),
    Match.when("greater", () =>
      studentTQuantile(confidenceLevel, degreesOfFreedom)),
    Match.when("less", () => studentTQuantile(confidenceLevel, degreesOfFreedom)),
    Match.exhaustive
  )

const intervalForEstimate = (
  estimate: number,
  standardError: number,
  degreesOfFreedom: number,
  confidenceLevel: number,
  alternative: HypothesisAlternativeType
): ConfidenceInterval => {
  const margin = N.multiply(criticalValue(confidenceLevel, degreesOfFreedom, alternative), standardError)

  return Match.value(alternative).pipe(
    Match.when("twoSided", () =>
      new ConfidenceInterval({
        confidenceLevel,
        lower: N.subtract(estimate, margin),
        upper: N.sum(estimate, margin)
      })),
    Match.when("greater", () =>
      new ConfidenceInterval({
        confidenceLevel,
        lower: N.subtract(estimate, margin),
        upper: null
      })),
    Match.when("less", () =>
      new ConfidenceInterval({
        confidenceLevel,
        lower: null,
        upper: N.sum(estimate, margin)
      })),
    Match.exhaustive
  )
}

const pValueForStatistic = (
  statistic: number,
  degreesOfFreedom: number,
  alternative: HypothesisAlternativeType
): number => {
  const cdf = studentTCdf(statistic, degreesOfFreedom)

  return clampOpenUnitInterval(
    Match.value(alternative).pipe(
      Match.when("twoSided", () => N.multiply(2, N.min(cdf, N.subtract(1, cdf)))),
      Match.when("greater", () => N.subtract(1, cdf)),
      Match.when("less", () => cdf),
      Match.exhaustive
    )
  )
}

const sampleStandardError = (variance: number, sampleSize: number): number => sqrt(N.unsafeDivide(variance, sampleSize))

const pooledStandardDeviation = (
  varianceA: number,
  varianceB: number,
  sampleSizeA: number,
  sampleSizeB: number
): number =>
  sqrt(
    N.unsafeDivide(
      N.sum(
        N.multiply(N.subtract(sampleSizeA, 1), varianceA),
        N.multiply(N.subtract(sampleSizeB, 1), varianceB)
      ),
      N.subtract(N.sum(sampleSizeA, sampleSizeB), 2)
    )
  )

const welchDegreesOfFreedom = (
  varianceA: number,
  varianceB: number,
  sampleSizeA: number,
  sampleSizeB: number
): number => {
  const scaledVarianceA = N.unsafeDivide(varianceA, sampleSizeA)
  const scaledVarianceB = N.unsafeDivide(varianceB, sampleSizeB)
  const totalScaledVariance = N.sum(scaledVarianceA, scaledVarianceB)

  return N.unsafeDivide(
    N.multiply(totalScaledVariance, totalScaledVariance),
    N.sum(
      N.unsafeDivide(N.multiply(scaledVarianceA, scaledVarianceA), N.subtract(sampleSizeA, 1)),
      N.unsafeDivide(N.multiply(scaledVarianceB, scaledVarianceB), N.subtract(sampleSizeB, 1))
    )
  )
}

/**
 * Confidence interval for a one-sample mean.
 *
 * @since 0.3.0
 * @category internal
 */
export const confidenceIntervalMean = (
  values: Chunk.Chunk<number>,
  options?: MeanConfidenceIntervalOptions
): MeanConfidenceIntervalReport => {
  const confidenceLevel = defaultConfidenceLevel(options?.confidenceLevel)
  const alternative = defaultAlternative(options?.alternative)
  const estimate = Estimators.mean(values)
  const variance = Estimators.variance(values)
  const sampleSize = Chunk.size(values)
  const standardError = sampleStandardError(variance, sampleSize)
  const degreesOfFreedom = N.subtract(sampleSize, 1)

  return new MeanConfidenceIntervalReport({
    estimate,
    standardError,
    degreesOfFreedom,
    alternative,
    interval: intervalForEstimate(estimate, standardError, degreesOfFreedom, confidenceLevel, alternative)
  })
}

/**
 * One-sample t-test over a released report envelope.
 *
 * @since 0.3.0
 * @category internal
 */
export const oneSampleTTest = (
  values: Chunk.Chunk<number>,
  options?: TTestOptions
): TTestReport => {
  const nullValue = Option.getOrElse(Option.fromNullable(options?.nullValue), () => 0)
  const alpha = defaultAlpha(options?.alpha)
  const confidenceLevel = clampOpenUnitInterval(N.subtract(1, alpha))
  const alternative = defaultAlternative(options?.alternative)
  const mean = Estimators.mean(values)
  const variance = Estimators.variance(values)
  const sampleSize = Chunk.size(values)
  const degreesOfFreedom = N.subtract(sampleSize, 1)
  const standardDeviation = sqrt(variance)
  const standardError = sampleStandardError(variance, sampleSize)
  const estimate = N.subtract(mean, nullValue)
  const statistic = N.unsafeDivide(estimate, standardError)

  return new TTestReport({
    method: "oneSampleTTest",
    estimate,
    nullValue,
    standardError,
    statistic,
    pValue: pValueForStatistic(statistic, degreesOfFreedom, alternative),
    degreesOfFreedom,
    alternative,
    confidenceLevel,
    interval: intervalForEstimate(estimate, standardError, degreesOfFreedom, confidenceLevel, alternative),
    effectSize: N.unsafeDivide(estimate, standardDeviation)
  })
}

/**
 * Two-sample Welch t-test over a released report envelope.
 *
 * @since 0.3.0
 * @category internal
 */
export const twoSampleTTest = (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>,
  options?: TTestOptions
): TTestReport => {
  const nullValue = Option.getOrElse(Option.fromNullable(options?.nullValue), () => 0)
  const alpha = defaultAlpha(options?.alpha)
  const confidenceLevel = clampOpenUnitInterval(N.subtract(1, alpha))
  const alternative = defaultAlternative(options?.alternative)
  const sampleSizeA = Chunk.size(a)
  const sampleSizeB = Chunk.size(b)
  const meanA = Estimators.mean(a)
  const meanB = Estimators.mean(b)
  const varianceA = Estimators.variance(a)
  const varianceB = Estimators.variance(b)
  const estimate = N.subtract(N.subtract(meanA, meanB), nullValue)
  const standardError = sqrt(N.sum(N.unsafeDivide(varianceA, sampleSizeA), N.unsafeDivide(varianceB, sampleSizeB)))
  const degreesOfFreedom = welchDegreesOfFreedom(varianceA, varianceB, sampleSizeA, sampleSizeB)
  const statistic = N.unsafeDivide(estimate, standardError)

  return new TTestReport({
    method: "twoSampleTTest",
    estimate,
    nullValue,
    standardError,
    statistic,
    pValue: pValueForStatistic(statistic, degreesOfFreedom, alternative),
    degreesOfFreedom,
    alternative,
    confidenceLevel,
    interval: intervalForEstimate(estimate, standardError, degreesOfFreedom, confidenceLevel, alternative),
    effectSize: N.unsafeDivide(
      estimate,
      pooledStandardDeviation(varianceA, varianceB, sampleSizeA, sampleSizeB)
    )
  })
}
