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

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { StatisticsDecodeError, StatisticsDomainViolationError, StatisticsShapeError } from "./errors.js"
import * as Estimators from "./internal/estimators.js"
import { StatisticsDomainModel } from "./model.js"
import { SampleInput, SummaryStatistics, TwoSampleInput } from "./schema.js"

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
