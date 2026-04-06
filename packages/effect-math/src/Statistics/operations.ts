/**
 * Statistics operation surface — pure kernel re-exports over immutable
 * `Chunk` carriers, Schema-validated variants with boundary input checking,
 * and policy-aware operations that respect `PrecisionPolicyService`
 * and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Match, Option, Schema } from "effect"

import { withCustomPolicyGuards, withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { abs } from "../Numeric/operations.js"
import {
  StatisticsDecodeError,
  StatisticsDomainViolationError,
  StatisticsParameterError,
  StatisticsShapeError
} from "./errors.js"
import * as Estimators from "./internal/estimators.js"
import * as Inference from "./internal/inference.js"
import * as Power from "./internal/power.js"
import { StatisticsDomainModel } from "./model.js"
import {
  MeanConfidenceIntervalInput,
  OneSampleTTestInput,
  PowerForMeanDifferenceInput,
  SampleInput,
  SampleSizeForTargetPowerInput,
  SummaryStatistics,
  TwoSampleInput,
  TwoSampleTTestInput
} from "./schema.js"
import type {
  HypothesisAlternativeType,
  MeanConfidenceIntervalReport,
  PowerAnalysisReport,
  SampleSizeForTargetPowerReport,
  TTestReport
} from "./schema.js"

type MeanConfidenceIntervalOptions = Readonly<{
  readonly confidenceLevel?: number
  readonly alternative?: HypothesisAlternativeType
}>

type TTestOptions = Readonly<{
  readonly nullValue?: number
  readonly alpha?: number
  readonly alternative?: HypothesisAlternativeType
}>

type PowerAnalysisOptions = Readonly<{
  readonly alpha?: number
  readonly alternative?: HypothesisAlternativeType
}>

type SampleSizeForTargetPowerOptions =
  & Readonly<{
    readonly maxSampleSize?: number
  }>
  & PowerAnalysisOptions

const EFFECT_SIZE_ZERO_TOLERANCE = 1e-12

const decodeStatisticsInput = <A, I>(schema: Schema.Schema<A, I, never>, input: unknown, operation: string) =>
  Schema.decodeUnknown(schema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.mapError((error) =>
      new StatisticsDecodeError({
        operation,
        message: error.message
      })
    )
  )

const requireSampleSize = (operation: string, sampleSize: number, message: string) =>
  Effect.filterOrFail(
    Effect.succeed(sampleSize),
    (value) => value >= 2,
    (value) =>
      new StatisticsShapeError({
        operation,
        expected: "at least 2 samples",
        actual: `${value} sample(s)`,
        message
      })
  )

const requireNonZeroEffectSize = (operation: string, effectSize: number) =>
  Effect.filterOrFail(
    Effect.succeed(effectSize),
    (value) => abs(value) > EFFECT_SIZE_ZERO_TOLERANCE,
    () =>
      new StatisticsParameterError({
        operation,
        message: "Sample-size inversion requires a non-zero standardized effect size"
      })
  )

const meanConfidenceIntervalReportIsFinite = (report: MeanConfidenceIntervalReport): boolean =>
  Number.isFinite(report.estimate) &&
  Number.isFinite(report.standardError) &&
  Number.isFinite(report.degreesOfFreedom) &&
  (report.interval.lower === null || Number.isFinite(report.interval.lower)) &&
  (report.interval.upper === null || Number.isFinite(report.interval.upper))

const tTestReportIsFinite = (report: TTestReport): boolean =>
  meanConfidenceIntervalReportIsFinite(report) &&
  Number.isFinite(report.statistic) &&
  Number.isFinite(report.effectSize) &&
  Number.isFinite(report.pValue)

const powerReportIsFinite = (report: PowerAnalysisReport): boolean =>
  Number.isFinite(report.effectSize) &&
  Number.isFinite(report.sampleSize) &&
  Number.isFinite(report.alpha) &&
  Number.isFinite(report.degreesOfFreedom) &&
  Number.isFinite(report.criticalValue) &&
  Number.isFinite(report.noncentrality) &&
  Number.isFinite(report.power)

const sampleSizePowerReportIsFinite = (report: SampleSizeForTargetPowerReport): boolean =>
  Number.isFinite(report.effectSize) &&
  Number.isFinite(report.targetPower) &&
  Number.isFinite(report.alpha) &&
  Number.isFinite(report.sampleSize) &&
  Number.isFinite(report.achievedPower) &&
  Number.isFinite(report.solver.root) &&
  Number.isFinite(report.solver.residual)

const compactMeanConfidenceIntervalOptions = (
  confidenceLevel?: number,
  alternative?: HypothesisAlternativeType
): MeanConfidenceIntervalOptions => ({
  ...Option.match(Option.fromNullable(confidenceLevel), {
    onNone: () => ({}),
    onSome: (confidenceLevel) => ({ confidenceLevel })
  }),
  ...Option.match(Option.fromNullable(alternative), {
    onNone: () => ({}),
    onSome: (alternative) => ({ alternative })
  })
})

const compactTTestOptions = (
  nullValue?: number,
  alpha?: number,
  alternative?: HypothesisAlternativeType
): TTestOptions => ({
  ...Option.match(Option.fromNullable(nullValue), {
    onNone: () => ({}),
    onSome: (nullValue) => ({ nullValue })
  }),
  ...Option.match(Option.fromNullable(alpha), {
    onNone: () => ({}),
    onSome: (alpha) => ({ alpha })
  }),
  ...Option.match(Option.fromNullable(alternative), {
    onNone: () => ({}),
    onSome: (alternative) => ({ alternative })
  })
})

const compactPowerOptions = (
  alpha?: number,
  alternative?: HypothesisAlternativeType
): PowerAnalysisOptions => ({
  ...Option.match(Option.fromNullable(alpha), {
    onNone: () => ({}),
    onSome: (alpha) => ({ alpha })
  }),
  ...Option.match(Option.fromNullable(alternative), {
    onNone: () => ({}),
    onSome: (alternative) => ({ alternative })
  })
})

const compactSampleSizeOptions = (
  alpha?: number,
  alternative?: HypothesisAlternativeType,
  maxSampleSize?: number
): SampleSizeForTargetPowerOptions => ({
  ...compactPowerOptions(alpha, alternative),
  ...Option.match(Option.fromNullable(maxSampleSize), {
    onNone: () => ({}),
    onSome: (maxSampleSize) => ({ maxSampleSize })
  })
})

/**
 * Lifts the static `StatisticsDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadStatisticsDomain = Effect.succeed(StatisticsDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports — operate on Chunk<number>
// ---------------------------------------------------------------------------

/**
 * Arithmetic mean `x̄ = (Σ xᵢ) / n`. Assumes a non-empty chunk; returns
 * `NaN` for empty input.
 *
 * @see {@link meanValidated} for Schema-validated boundary input
 * @see {@link summaryStatisticsWithPolicies} for full descriptive statistics with policy support
 * @since 0.1.0
 * @category operations
 */
export const mean: (values: Chunk.Chunk<number>) => number = Estimators.mean

/**
 * Sample variance with Bessel correction — `s² = Σ(xᵢ − x̄)² / (n − 1)`.
 * Requires at least 2 observations; returns `NaN` for fewer.
 *
 * @see {@link varianceValidated} for Schema-validated boundary input with sample-size checking
 * @see {@link standardDeviation} for the square root of this value
 * @since 0.1.0
 * @category operations
 */
export const variance: (values: Chunk.Chunk<number>) => number = Estimators.variance

/**
 * Sample standard deviation — `s = √(s²)` where `s²` is the
 * Bessel-corrected variance. Requires at least 2 observations.
 *
 * @see {@link variance} for the underlying variance computation
 * @see {@link summaryStatisticsValidated} for full descriptive statistics
 * @since 0.1.0
 * @category operations
 */
export const standardDeviation: (values: Chunk.Chunk<number>) => number = Estimators.standardDeviation

/**
 * Descriptive statistics for a non-empty chunk using one pass over the data.
 *
 * Singleton chunks produce zero variance and standard deviation.
 *
 * @see {@link summaryStatisticsValidated} for boundary-validated input
 * @see {@link summaryStatisticsWithPolicies} for runtime-policy enforcement
 * @since 0.2.1
 * @category operations
 */
export const summaryStatistics = (values: Chunk.NonEmptyChunk<number>): SummaryStatistics => {
  const summary = Estimators.summaryStatistics(values)

  return new SummaryStatistics({
    count: summary.count,
    max: summary.maximum,
    mean: summary.mean,
    min: summary.minimum,
    standardDeviation: summary.standardDeviation,
    variance: summary.variance
  })
}

/**
 * Sample covariance `cov(a, b) = Σ(aᵢ − ā)(bᵢ − b̄) / (n − 1)` with
 * Bessel correction. Both chunks must have the same length and at least
 * 2 observations.
 *
 * @see {@link covarianceValidated} for Schema-validated boundary input with shape checking
 * @since 0.1.0
 * @category operations
 */
export const covariance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Estimators.covariance

/**
 * Minimum value of a chunk — returns `Option.none()` for empty input,
 * `Option.some(min)` otherwise.
 *
 * @see {@link minimumValidated} for Schema-validated boundary input
 * @since 0.1.0
 * @category operations
 */
export const minimum: (values: Chunk.Chunk<number>) => Option.Option<number> = Estimators.minimum

/**
 * Maximum value of a chunk — returns `Option.none()` for empty input,
 * `Option.some(max)` otherwise.
 *
 * @see {@link maximumValidated} for Schema-validated boundary input
 * @since 0.1.0
 * @category operations
 */
export const maximum: (values: Chunk.Chunk<number>) => Option.Option<number> = Estimators.maximum

/**
 * Confidence interval for a one-sample mean.
 *
 * @since 0.3.0
 * @category operations
 */
export const confidenceIntervalMean = (
  values: Chunk.Chunk<number>,
  options?: MeanConfidenceIntervalOptions
) => Inference.confidenceIntervalMean(values, options)

/**
 * One-sample t-test over a released report envelope.
 *
 * @since 0.3.0
 * @category operations
 */
export const oneSampleTTest = (
  values: Chunk.Chunk<number>,
  options?: TTestOptions
) => Inference.oneSampleTTest(values, options)

/**
 * Two-sample Welch t-test over a released report envelope.
 *
 * @since 0.3.0
 * @category operations
 */
export const twoSampleTTest = (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>,
  options?: TTestOptions
) => Inference.twoSampleTTest(a, b, options)

/**
 * Power analysis for an equal-group standardized mean-difference test.
 *
 * @since 0.3.0
 * @category operations
 */
export const powerForMeanDifference = (
  effectSize: number,
  sampleSize: number,
  options?: PowerAnalysisOptions
) => Power.powerForMeanDifference(effectSize, sampleSize, options)

/**
 * Sample-size inversion for an equal-group standardized mean-difference test.
 *
 * @since 0.3.0
 * @category operations
 */
export const sampleSizeForTargetPower = (
  effectSize: number,
  targetPower: number,
  options?: SampleSizeForTargetPowerOptions
) => Power.sampleSizeForTargetPower(effectSize, targetPower, options)

// ---------------------------------------------------------------------------
// Schema-validated operations with boundary input checking
// ---------------------------------------------------------------------------

/**
 * Boundary-validated mean — decodes `input` through `SampleInput` and
 * computes `x̄ = (Σ xᵢ) / n`. Fails with `StatisticsDecodeError` for
 * malformed input.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Statistics } from "effect-math"
 *
 * const program = Statistics.meanValidated({ values: [2, 4, 6] })
 * // Effect succeeds with 4
 * ```
 *
 * @see {@link mean} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const meanValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new StatisticsDecodeError({
          operation: "mean",
          message: error.message
        })
      )
    )

    return Estimators.mean(Chunk.fromIterable(decoded.values))
  })

/**
 * Boundary-validated variance — decodes `input` through `SampleInput`,
 * requires at least 2 samples for Bessel correction, and computes
 * `s² = Σ(xᵢ − x̄)² / (n − 1)`. Fails with `StatisticsDecodeError` for
 * malformed input or `StatisticsShapeError` for insufficient data.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Statistics } from "effect-math"
 *
 * const program = Statistics.varianceValidated({ values: [2, 4, 6] })
 * // Effect succeeds with 4
 * ```
 *
 * @see {@link variance} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const varianceValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new StatisticsDecodeError({
          operation: "variance",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => d.values.length >= 2,
      () =>
        new StatisticsShapeError({
          operation: "variance",
          expected: "at least 2 samples",
          actual: `${decoded.values.length} sample(s)`,
          message: "Bessel-corrected variance requires at least 2 samples"
        })
    )

    return Estimators.variance(Chunk.fromIterable(decoded.values))
  })

/**
 * Boundary-validated summary statistics — decodes `input` through
 * `SampleInput`, requires at least 2 samples, and computes mean, variance,
 * standard deviation, min, max, and count. Returns a `SummaryStatistics`
 * TaggedClass instance.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Statistics } from "effect-math"
 *
 * const program = Statistics.summaryStatisticsValidated({ values: [2, 4, 6, 8] })
 * ```
 *
 * @see {@link summaryStatisticsWithPolicies} for policy-aware variant
 * @see {@link mean} / {@link variance} / {@link standardDeviation} for individual estimators
 * @since 0.1.0
 * @category operations
 */
export const summaryStatisticsValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new StatisticsDecodeError({
          operation: "summaryStatistics",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => d.values.length >= 2,
      () =>
        new StatisticsShapeError({
          operation: "summaryStatistics",
          expected: "at least 2 samples",
          actual: `${decoded.values.length} sample(s)`,
          message: "Summary statistics requires at least 2 samples for variance"
        })
    )

    const chunk = Chunk.fromIterable(decoded.values)
    const m = Estimators.mean(chunk)
    const v = Estimators.variance(chunk)
    const sd = Estimators.standardDeviation(chunk)
    const minVal = Option.getOrElse(Estimators.minimum(chunk), () => 0)
    const maxVal = Option.getOrElse(Estimators.maximum(chunk), () => 0)

    return new SummaryStatistics({
      mean: m,
      variance: v,
      standardDeviation: sd,
      min: minVal,
      max: maxVal,
      count: Chunk.size(chunk)
    })
  })

/**
 * Boundary-validated covariance — decodes `input` through `TwoSampleInput`,
 * validates equal-length samples with at least 2 observations, and computes
 * `cov(a, b) = Σ(aᵢ − ā)(bᵢ − b̄) / (n − 1)`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Statistics } from "effect-math"
 *
 * const program = Statistics.covarianceValidated({ a: [1, 2, 3], b: [4, 5, 6] })
 * // Effect succeeds with 1
 * ```
 *
 * @see {@link covariance} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const covarianceValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(TwoSampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new StatisticsDecodeError({
          operation: "covariance",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => d.a.length === d.b.length,
      (d) =>
        new StatisticsShapeError({
          operation: "covariance",
          expected: `length ${d.a.length}`,
          actual: `length ${d.b.length}`,
          message: "Covariance requires samples of equal length"
        })
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => d.a.length >= 2,
      () =>
        new StatisticsShapeError({
          operation: "covariance",
          expected: "at least 2 samples",
          actual: `${decoded.a.length} sample(s)`,
          message: "Bessel-corrected covariance requires at least 2 samples"
        })
    )

    return Estimators.covariance(
      Chunk.fromIterable(decoded.a),
      Chunk.fromIterable(decoded.b)
    )
  })

/**
 * Boundary-validated minimum — decodes `input` through `SampleInput` and
 * returns `Option.some(min)` for non-empty valid input. Fails with
 * `StatisticsDecodeError` for malformed input.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Statistics } from "effect-math"
 *
 * const program = Statistics.minimumValidated({ values: [3, 1, 2] })
 * // Effect succeeds with Option.some(1)
 * ```
 *
 * @see {@link minimum} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const minimumValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new StatisticsDecodeError({
          operation: "minimum",
          message: error.message
        })
      )
    )

    return Estimators.minimum(Chunk.fromIterable(decoded.values))
  })

/**
 * Boundary-validated maximum — decodes `input` through `SampleInput` and
 * returns `Option.some(max)` for non-empty valid input. Fails with
 * `StatisticsDecodeError` for malformed input.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Statistics } from "effect-math"
 *
 * const program = Statistics.maximumValidated({ values: [3, 1, 2] })
 * // Effect succeeds with Option.some(3)
 * ```
 *
 * @see {@link maximum} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const maximumValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new StatisticsDecodeError({
          operation: "maximum",
          message: error.message
        })
      )
    )

    return Estimators.maximum(Chunk.fromIterable(decoded.values))
  })

/**
 * Boundary-validated confidence interval for a one-sample mean.
 *
 * @since 0.3.0
 * @category operations
 */
export const confidenceIntervalMeanValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeStatisticsInput(MeanConfidenceIntervalInput, input, "confidenceIntervalMean")
    yield* requireSampleSize(
      "confidenceIntervalMean",
      decoded.values.length,
      "Confidence intervals require at least 2 samples"
    )

    return Inference.confidenceIntervalMean(
      Chunk.fromIterable(decoded.values),
      compactMeanConfidenceIntervalOptions(decoded.confidenceLevel, decoded.alternative)
    )
  })

/**
 * Boundary-validated one-sample t-test.
 *
 * @since 0.3.0
 * @category operations
 */
export const oneSampleTTestValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeStatisticsInput(OneSampleTTestInput, input, "oneSampleTTest")
    yield* requireSampleSize(
      "oneSampleTTest",
      decoded.values.length,
      "One-sample t-tests require at least 2 samples"
    )

    return Inference.oneSampleTTest(
      Chunk.fromIterable(decoded.values),
      compactTTestOptions(decoded.nullValue, decoded.alpha, decoded.alternative)
    )
  })

/**
 * Boundary-validated two-sample Welch t-test.
 *
 * @since 0.3.0
 * @category operations
 */
export const twoSampleTTestValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeStatisticsInput(TwoSampleTTestInput, input, "twoSampleTTest")
    yield* requireSampleSize(
      "twoSampleTTest",
      decoded.a.length,
      "Two-sample t-tests require at least 2 observations in the first sample"
    )
    yield* requireSampleSize(
      "twoSampleTTest",
      decoded.b.length,
      "Two-sample t-tests require at least 2 observations in the second sample"
    )

    return Inference.twoSampleTTest(
      Chunk.fromIterable(decoded.a),
      Chunk.fromIterable(decoded.b),
      compactTTestOptions(decoded.nullValue, decoded.alpha, decoded.alternative)
    )
  })

/**
 * Boundary-validated power analysis for an equal-group mean difference.
 *
 * @since 0.3.0
 * @category operations
 */
export const powerForMeanDifferenceValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeStatisticsInput(PowerForMeanDifferenceInput, input, "powerForMeanDifference")

    return Power.powerForMeanDifference(
      decoded.effectSize,
      decoded.sampleSize,
      compactPowerOptions(decoded.alpha, decoded.alternative)
    )
  })

/**
 * Boundary-validated sample-size inversion for an equal-group mean difference.
 *
 * @since 0.3.0
 * @category operations
 */
export const sampleSizeForTargetPowerValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeStatisticsInput(
      SampleSizeForTargetPowerInput,
      input,
      "sampleSizeForTargetPower"
    )
    yield* requireNonZeroEffectSize("sampleSizeForTargetPower", decoded.effectSize)

    const report = Power.sampleSizeForTargetPower(
      decoded.effectSize,
      decoded.targetPower,
      compactSampleSizeOptions(decoded.alpha, decoded.alternative, decoded.maxSampleSize)
    )

    yield* Effect.filterOrFail(
      Effect.succeed(report),
      (value) => value.achievedPower >= decoded.targetPower,
      () =>
        new StatisticsParameterError({
          operation: "sampleSizeForTargetPower",
          message: "Target power is not achievable within the declared maximum sample size"
        })
    )

    return report
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware summary statistics that reads two runtime services from
 * context:
 *
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite mean, variance, or stddev with `StatisticsDomainViolationError`; `"relaxed"` passes through
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug` with precision policy and sample size
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService,
 *   Statistics
 * } from "effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = Statistics.summaryStatisticsWithPolicies(
 *   Chunk.fromIterable([2, 4, 6, 8])
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link summaryStatisticsValidated} for the boundary-validated variant (no service requirements)
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const summaryStatisticsWithPolicies = (values: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    yield* Effect.filterOrFail(
      Effect.succeed(Chunk.size(values)),
      (n) => n >= 2,
      (n) =>
        new StatisticsShapeError({
          operation: "summaryStatisticsWithPolicies",
          expected: "at least 2 samples",
          actual: `${n} sample(s)`,
          message: "Summary statistics requires at least 2 samples for variance"
        })
    )

    const m = Estimators.mean(values)
    const v = Estimators.variance(values)
    const sd = Estimators.standardDeviation(values)
    const minVal = Option.getOrElse(Estimators.minimum(values), () => 0)
    const maxVal = Option.getOrElse(Estimators.maximum(values), () => 0)
    const count = Chunk.size(values)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(true),
          () => Number.isFinite(m) && Number.isFinite(v) && Number.isFinite(sd),
          () =>
            new StatisticsDomainViolationError({
              operation: "summaryStatisticsWithPolicies",
              message: `Non-finite summary statistics result: mean=${m}, variance=${v}, stddev=${sd}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.logDebug("Statistics.summaryStatisticsWithPolicies").pipe(
          Effect.annotateLogs({
            precision: precision.policy,
            sampleSize: String(count)
          })
        )),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return new SummaryStatistics({
      mean: m,
      variance: v,
      standardDeviation: sd,
      min: minVal,
      max: maxVal,
      count
    })
  })

/**
 * Policy-aware mean that reads two runtime services from context:
 *
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite results
 *   with `StatisticsDomainViolationError`; `"relaxed"` passes them through.
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug`
 *   with precision policy, sample size, result, and elapsed-ms annotations.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService,
 *   Statistics
 * } from "effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = Statistics.meanWithPolicies(
 *   Chunk.fromIterable([2, 4, 6])
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link mean} for the pure kernel (no policy seams)
 * @see {@link meanValidated} for the boundary-validated variant
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const meanWithPolicies = (values: Chunk.Chunk<number>) =>
  withScalarPolicyGuards({
    operation: "Statistics.meanWithPolicies",
    compute: () => Estimators.mean(values),
    makeError: (message) => new StatisticsDomainViolationError({ operation: "meanWithPolicies", message }),
    annotations: (result) => ({ sampleSize: String(Chunk.size(values)), result: String(result) })
  })

/**
 * Policy-aware variance that reads two runtime services from context:
 *
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite results
 *   with `StatisticsDomainViolationError`; `"relaxed"` passes them through.
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug`
 *   with precision policy, sample size, result, and elapsed-ms annotations.
 *
 * Requires at least 2 samples for Bessel correction — fails with
 * `StatisticsShapeError` otherwise.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService,
 *   Statistics
 * } from "effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = Statistics.varianceWithPolicies(
 *   Chunk.fromIterable([2, 4, 6])
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link variance} for the pure kernel (no policy seams)
 * @see {@link varianceValidated} for the boundary-validated variant
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const varianceWithPolicies = (values: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    yield* Effect.filterOrFail(
      Effect.succeed(Chunk.size(values)),
      (n) => n >= 2,
      (n) =>
        new StatisticsShapeError({
          operation: "varianceWithPolicies",
          expected: "at least 2 samples",
          actual: `${n} sample(s)`,
          message: "Bessel-corrected variance requires at least 2 samples"
        })
    )
    return yield* withScalarPolicyGuards({
      operation: "Statistics.varianceWithPolicies",
      compute: () => Estimators.variance(values),
      makeError: (message) => new StatisticsDomainViolationError({ operation: "varianceWithPolicies", message }),
      annotations: (result) => ({ sampleSize: String(Chunk.size(values)), result: String(result) })
    })
  })

/**
 * Policy-aware covariance that reads two runtime services from context:
 *
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite results
 *   with `StatisticsDomainViolationError`; `"relaxed"` passes them through.
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug`
 *   with precision policy, sample size, result, and elapsed-ms annotations.
 *
 * Requires equal-length samples with at least 2 observations — fails with
 * `StatisticsShapeError` otherwise.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService,
 *   Statistics
 * } from "effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = Statistics.covarianceWithPolicies(
 *   Chunk.fromIterable([1, 2, 3]),
 *   Chunk.fromIterable([4, 5, 6])
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link covariance} for the pure kernel (no policy seams)
 * @see {@link covarianceValidated} for the boundary-validated variant
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const covarianceWithPolicies = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    yield* Effect.filterOrFail(
      Effect.succeed({ aLen: Chunk.size(a), bLen: Chunk.size(b) }),
      ({ aLen, bLen }) => aLen === bLen,
      ({ aLen, bLen }) =>
        new StatisticsShapeError({
          operation: "covarianceWithPolicies",
          expected: `length ${aLen}`,
          actual: `length ${bLen}`,
          message: "Covariance requires samples of equal length"
        })
    )

    yield* Effect.filterOrFail(
      Effect.succeed(Chunk.size(a)),
      (n) => n >= 2,
      (n) =>
        new StatisticsShapeError({
          operation: "covarianceWithPolicies",
          expected: "at least 2 samples",
          actual: `${n} sample(s)`,
          message: "Bessel-corrected covariance requires at least 2 samples"
        })
    )

    return yield* withScalarPolicyGuards({
      operation: "Statistics.covarianceWithPolicies",
      compute: () => Estimators.covariance(a, b),
      makeError: (message) => new StatisticsDomainViolationError({ operation: "covarianceWithPolicies", message }),
      annotations: (result) => ({ sampleSize: String(Chunk.size(a)), result: String(result) })
    })
  })

/**
 * Policy-aware one-sample mean confidence interval.
 *
 * @since 0.3.0
 * @category operations
 */
export const confidenceIntervalMeanWithPolicies = (
  values: Chunk.Chunk<number>,
  options?: MeanConfidenceIntervalOptions
) =>
  Effect.gen(function*() {
    yield* requireSampleSize(
      "confidenceIntervalMeanWithPolicies",
      Chunk.size(values),
      "Confidence intervals require at least 2 samples"
    )

    const report = Inference.confidenceIntervalMean(values, options)

    return yield* withCustomPolicyGuards({
      operation: "Statistics.confidenceIntervalMeanWithPolicies",
      compute: () => report,
      isValid: meanConfidenceIntervalReportIsFinite,
      makeError: (message) =>
        new StatisticsDomainViolationError({ operation: "confidenceIntervalMeanWithPolicies", message }),
      annotations: (value) => ({
        sampleSize: String(Chunk.size(values)),
        estimate: String(value.estimate),
        standardError: String(value.standardError)
      })
    })
  })

/**
 * Policy-aware one-sample t-test.
 *
 * @since 0.3.0
 * @category operations
 */
export const oneSampleTTestWithPolicies = (
  values: Chunk.Chunk<number>,
  options?: TTestOptions
) =>
  Effect.gen(function*() {
    yield* requireSampleSize(
      "oneSampleTTestWithPolicies",
      Chunk.size(values),
      "One-sample t-tests require at least 2 samples"
    )

    const report = Inference.oneSampleTTest(values, options)

    return yield* withCustomPolicyGuards({
      operation: "Statistics.oneSampleTTestWithPolicies",
      compute: () => report,
      isValid: tTestReportIsFinite,
      makeError: (message) => new StatisticsDomainViolationError({ operation: "oneSampleTTestWithPolicies", message }),
      annotations: (value) => ({
        sampleSize: String(Chunk.size(values)),
        statistic: String(value.statistic),
        pValue: String(value.pValue)
      })
    })
  })

/**
 * Policy-aware two-sample Welch t-test.
 *
 * @since 0.3.0
 * @category operations
 */
export const twoSampleTTestWithPolicies = (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>,
  options?: TTestOptions
) =>
  Effect.gen(function*() {
    yield* requireSampleSize(
      "twoSampleTTestWithPolicies",
      Chunk.size(a),
      "Two-sample t-tests require at least 2 observations in the first sample"
    )
    yield* requireSampleSize(
      "twoSampleTTestWithPolicies",
      Chunk.size(b),
      "Two-sample t-tests require at least 2 observations in the second sample"
    )

    const report = Inference.twoSampleTTest(a, b, options)

    return yield* withCustomPolicyGuards({
      operation: "Statistics.twoSampleTTestWithPolicies",
      compute: () => report,
      isValid: tTestReportIsFinite,
      makeError: (message) => new StatisticsDomainViolationError({ operation: "twoSampleTTestWithPolicies", message }),
      annotations: (value) => ({
        sampleSizeA: String(Chunk.size(a)),
        sampleSizeB: String(Chunk.size(b)),
        statistic: String(value.statistic),
        pValue: String(value.pValue)
      })
    })
  })

/**
 * Policy-aware power analysis for an equal-group mean difference.
 *
 * @since 0.3.0
 * @category operations
 */
export const powerForMeanDifferenceWithPolicies = (
  effectSize: number,
  sampleSize: number,
  options?: PowerAnalysisOptions
) => {
  const report = Power.powerForMeanDifference(effectSize, sampleSize, options)

  return withCustomPolicyGuards({
    operation: "Statistics.powerForMeanDifferenceWithPolicies",
    compute: () => report,
    isValid: powerReportIsFinite,
    makeError: (message) =>
      new StatisticsDomainViolationError({ operation: "powerForMeanDifferenceWithPolicies", message }),
    annotations: (value) => ({
      sampleSize: String(value.sampleSize),
      effectSize: String(value.effectSize),
      power: String(value.power)
    })
  })
}

/**
 * Policy-aware sample-size inversion for an equal-group mean difference.
 *
 * @since 0.3.0
 * @category operations
 */
export const sampleSizeForTargetPowerWithPolicies = (
  effectSize: number,
  targetPower: number,
  options?: SampleSizeForTargetPowerOptions
) =>
  Effect.gen(function*() {
    const report = yield* sampleSizeForTargetPowerValidated({
      effectSize,
      targetPower,
      alpha: options?.alpha,
      alternative: options?.alternative,
      maxSampleSize: options?.maxSampleSize
    })

    return yield* withCustomPolicyGuards({
      operation: "Statistics.sampleSizeForTargetPowerWithPolicies",
      compute: () => report,
      isValid: sampleSizePowerReportIsFinite,
      makeError: (message) =>
        new StatisticsDomainViolationError({ operation: "sampleSizeForTargetPowerWithPolicies", message }),
      annotations: (value) => ({
        effectSize: String(value.effectSize),
        targetPower: String(value.targetPower),
        sampleSize: String(value.sampleSize),
        achievedPower: String(value.achievedPower)
      })
    })
  })
