/**
 * Computes pure, validated, and policy-aware sample estimators.
 *
 * @remarks
 * Pure estimators trust their `Chunk` contents and sample shapes. Validated
 * estimators accept unknown input and reject non-finite observations. The
 * policy-aware variants accept unvalidated chunks and apply runtime precision
 * and diagnostics policies to their results.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Match, Option, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { StatisticsDecodeError, StatisticsDomainViolationError, StatisticsShapeError } from "./errors.js"
import * as Estimators from "./internal/estimators.js"
import { StatisticsDomainModel } from "./model.js"
import { SampleInput, SummaryStatistics, TwoSampleInput } from "./schema.js"

/**
 * Loads the provisional Statistics descriptor used for capability discovery.
 *
 * @returns The shared descriptor without service requirements or a failure channel.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadStatisticsDomain = Effect.succeed(StatisticsDomainModel)

// ---------------------------------------------------------------------------
// Pure estimators
// ---------------------------------------------------------------------------

/**
 * Computes the arithmetic mean of a numeric sample.
 *
 * @param values - Observations used without validation.
 * @returns The arithmetic mean, or `NaN` when `values` is empty.
 * @since 0.1.0
 * @category operations
 */
export const mean: (values: Chunk.Chunk<number>) => number = Estimators.mean

/**
 * Computes sample variance with Bessel's correction.
 *
 * @param values - Observations used without validation.
 * @returns The sum of squared deviations divided by `n - 1`. An empty sample returns negative zero; a singleton returns `NaN`.
 * @since 0.1.0
 * @category operations
 */
export const variance: (values: Chunk.Chunk<number>) => number = Estimators.variance

/**
 * Computes the square root of the Bessel-corrected sample variance.
 *
 * @param values - Observations used without validation.
 * @returns The sample standard deviation. An empty sample returns negative zero; a singleton returns `NaN`.
 * @since 0.1.0
 * @category operations
 */
export const standardDeviation: (values: Chunk.Chunk<number>) => number = Estimators.standardDeviation

/**
 * Computes a descriptive summary with a one-pass Welford accumulator.
 *
 * @remarks
 * Variance uses Bessel's correction. A singleton produces zero variance and
 * zero standard deviation.
 *
 * @example
 * ```ts
 * import { Statistics } from "@scenesystems/effect-math"
 * import { Chunk, Effect } from "effect"
 *
 * export const program = Effect.sync(() =>
 *   Statistics.summaryStatistics(Chunk.make(2, 4, 6, 8))
 * ).pipe(
 *   Effect.filterOrFail(
 *     (result) => result.mean === 5 && result.count === 4,
 *     () => "UnexpectedSummary"
 *   )
 * )
 * ```
 *
 * @param values - Non-empty observations used without finite-number validation.
 * @returns A new tagged summary containing sample variance and the observed extrema.
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
 * Computes Bessel-corrected sample covariance.
 *
 * @remarks
 * Equal lengths are a caller precondition. If the lengths differ, each mean
 * uses its full sample, paired deviations stop at the shorter sample, and the
 * denominator is `a.length - 1`. An empty `a` returns negative zero. A
 * singleton `a` returns `NaN`; when `a` has at least two observations and `b`
 * is empty, the result is zero.
 *
 * @param a - First sample, whose size determines the denominator.
 * @param b - Second sample paired with `a` by position.
 * @returns The sum of paired deviation products divided by `a.length - 1`.
 * @since 0.1.0
 * @category operations
 */
export const covariance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Estimators.covariance

/**
 * Finds the least observation in a sample.
 *
 * @returns `Option.none()` for an empty sample; otherwise the minimum in `Option.some()`.
 * @since 0.1.0
 * @category operations
 */
export const minimum: (values: Chunk.Chunk<number>) => Option.Option<number> = Estimators.minimum

/**
 * Finds the greatest observation in a sample.
 *
 * @returns `Option.none()` for an empty sample; otherwise the maximum in `Option.some()`.
 * @since 0.1.0
 * @category operations
 */
export const maximum: (values: Chunk.Chunk<number>) => Option.Option<number> = Estimators.maximum

// ---------------------------------------------------------------------------
// Schema-validated operations with boundary input checking
// ---------------------------------------------------------------------------

/**
 * Decodes a non-empty finite sample and computes its arithmetic mean.
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns The arithmetic mean of the decoded observations.
 * @throws {@link StatisticsDecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
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
 * Decodes a finite sample and computes Bessel-corrected variance.
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns The sample variance for two or more observations.
 * @throws {@link StatisticsDecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
 * @throws {@link StatisticsShapeError} in the Effect error channel when the decoded sample has one observation.
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
 * Decodes a finite sample and computes its descriptive summary.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Statistics } from "@scenesystems/effect-math"
 *
 * export const program = Statistics.summaryStatisticsValidated({
 *   values: [2, 4, 6, 8]
 * }).pipe(
 *   Effect.filterOrFail(
 *     (result) => result.mean === 5 && result.count === 4,
 *     () => "UnexpectedSummary"
 *   )
 * )
 * ```
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns A new tagged summary using Bessel-corrected variance.
 * @throws {@link StatisticsDecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
 * @throws {@link StatisticsShapeError} in the Effect error channel when the decoded sample has one observation.
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
 * Decodes two finite samples and computes their Bessel-corrected covariance.
 *
 * @param input - Untrusted input decoded by {@link TwoSampleInput}; excess fields are rejected.
 * @returns The covariance of equally sized samples containing at least two observations.
 * @throws {@link StatisticsDecodeError} in the Effect error channel when either sample is missing, empty, or non-finite.
 * @throws {@link StatisticsShapeError} in the Effect error channel when the samples differ in length or contain fewer than two observations.
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
 * Decodes a non-empty finite sample and finds its minimum.
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns The minimum in `Option.some()`; successful decoding rules out `Option.none()`.
 * @throws {@link StatisticsDecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
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
 * Decodes a non-empty finite sample and finds its maximum.
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns The maximum in `Option.some()`; successful decoding rules out `Option.none()`.
 * @throws {@link StatisticsDecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
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

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Computes a descriptive summary under runtime precision and diagnostics policies.
 *
 * @remarks
 * The input is not decoded. At least two observations are required. Strict
 * precision requires finite mean, variance, and standard deviation. Enabled
 * diagnostics emit one debug log containing the precision mode and sample
 * size. The strict check does not inspect the extrema separately. This
 * operation requires {@link PrecisionPolicyService} and
 * {@link DiagnosticsPolicyService}.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import { Statistics } from "@scenesystems/effect-math"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "@scenesystems/effect-math/contracts"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * export const program = Statistics.summaryStatisticsWithPolicies(
 *   Chunk.make(2, 4, 6, 8)
 * ).pipe(
 *   Effect.provide(policies),
 *   Effect.filterOrFail(
 *     (result) => result.mean === 5 && result.count === 4,
 *     () => "UnexpectedSummary"
 *   )
 * )
 * ```
 *
 * @param values - Observations used without finite-number validation.
 * @returns A new tagged summary using Bessel-corrected variance.
 * @throws {@link StatisticsShapeError} in the Effect error channel for fewer than two observations.
 * @throws {@link StatisticsDomainViolationError} in the Effect error channel when strict precision rejects a non-finite mean, variance, or standard deviation.
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
 * Computes an arithmetic mean under runtime precision and diagnostics policies.
 *
 * @remarks
 * The sample is not decoded, and an empty sample reaches the estimator as
 * `NaN`. Strict precision rejects any non-finite result. Enabled diagnostics
 * emit one debug log containing the precision mode, sample size, result, and
 * elapsed milliseconds. This operation requires {@link PrecisionPolicyService}
 * and {@link DiagnosticsPolicyService}.
 *
 * @param values - Observations used without shape or finite-number validation.
 * @returns The arithmetic mean, including `NaN` under relaxed precision for an empty sample.
 * @throws {@link StatisticsDomainViolationError} in the Effect error channel when strict precision rejects a non-finite result.
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
 * Computes Bessel-corrected variance under runtime precision and diagnostics policies.
 *
 * @remarks
 * The operation accepts the sample directly and requires at least two
 * observations. Strict precision rejects a non-finite result. Enabled
 * diagnostics emit one debug log containing the precision mode, sample size,
 * result, and elapsed milliseconds. This operation requires
 * {@link PrecisionPolicyService} and {@link DiagnosticsPolicyService}.
 *
 * @param values - Observations used without finite-number validation.
 * @returns The sample variance for two or more observations.
 * @throws {@link StatisticsShapeError} in the Effect error channel for fewer than two observations.
 * @throws {@link StatisticsDomainViolationError} in the Effect error channel when strict precision rejects a non-finite result.
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
 * Computes Bessel-corrected covariance under runtime precision and diagnostics policies.
 *
 * @remarks
 * The samples are not decoded. They must have equal lengths and at least two
 * observations. Strict precision rejects a non-finite result. Enabled
 * diagnostics emit one debug log containing the precision mode, sample size,
 * result, and elapsed milliseconds. This operation requires
 * {@link PrecisionPolicyService} and {@link DiagnosticsPolicyService}.
 *
 * @param a - First sample, paired with `b` by position.
 * @param b - Second sample, which must match the length of `a`.
 * @returns The covariance of the paired observations.
 * @throws {@link StatisticsShapeError} in the Effect error channel when lengths differ or either sample contains fewer than two observations.
 * @throws {@link StatisticsDomainViolationError} in the Effect error channel when strict precision rejects a non-finite result.
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
