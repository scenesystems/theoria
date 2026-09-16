/**
 * Statistical schemas, errors, and sample estimators.
 *
 * @since 0.1.0
 * @module
 */
import { Chunk, Effect, Match, Number, Schema, String } from "effect"
import type { Option } from "effect"

import * as PolicyGuard from "./internal/policyGuard.js"
import * as Estimators from "./internal/statistics/estimators.js"
import { sqrt } from "./Numeric.js"
import * as Policy from "./Policy.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const finite = Schema.Finite
const sample = Schema.NonEmptyChunk(finite)

/** Non-empty finite numeric sample.
 * @since 0.1.0
 * @category schemas
 */
export const SampleInput = Schema.Struct({ values: sample }).annotations({
  identifier: "@scenesystems/effect-math/Statistics/SampleInput"
})

/** Pair of non-empty finite numeric samples.
 * @since 0.1.0
 * @category schemas
 */
export const TwoSampleInput = Schema.Struct({ a: sample, b: sample }).annotations({
  identifier: "@scenesystems/effect-math/Statistics/TwoSampleInput"
})

/**
 * Decoded sample input.
 * @since 0.1.0
 * @category models
 */
export type SampleInput = typeof SampleInput.Type
/**
 * Decoded two-sample input.
 * @since 0.1.0
 * @category models
 */
export type TwoSampleInput = typeof TwoSampleInput.Type

/** Finite descriptive statistics for a non-empty sample.
 * @since 0.1.0
 * @category models
 */
export class SummaryStatistics extends Schema.TaggedClass<SummaryStatistics>()("SummaryStatistics", {
  mean: finite,
  variance: finite,
  standardDeviation: finite,
  min: finite,
  max: finite,
  count: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1))
}) {}

/** Malformed validated-estimator input.
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()("StatisticsDecodeError", {
  operation: Schema.Literal("mean", "variance", "summaryStatistics", "covariance", "minimum", "maximum"),
  message: Schema.String
}) {}

/** Too few observations or unequal sample lengths.
 * @since 0.1.0
 * @category errors
 */
export class ShapeError extends Schema.TaggedError<ShapeError>()("StatisticsShapeError", {
  operation: Schema.Literal(
    "variance",
    "summaryStatistics",
    "covariance",
    "summaryStatisticsWithPolicies",
    "varianceWithPolicies",
    "covarianceWithPolicies"
  ),
  expected: Schema.String,
  actual: Schema.String,
  message: Schema.String
}) {}

/** Non-finite estimator result rejected by strict precision.
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError extends Schema.TaggedError<DomainViolationError>()("StatisticsDomainViolationError", {
  operation: Schema.Literal(
    "summaryStatisticsWithPolicies",
    "meanWithPolicies",
    "varianceWithPolicies",
    "covarianceWithPolicies"
  ),
  message: Schema.String
}) {}

/** Recoverable Statistics operation failures.
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | ShapeError | DomainViolationError

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
 * import { Boolean, Chunk, Effect, Number } from "effect"
 *
 * export const program = Effect.sync(() =>
 *   Statistics.summaryStatistics(Chunk.make(2, 4, 6, 8))
 * ).pipe(
 *   Effect.filterOrFail(
 *     (result) => Boolean.and(Number.Equivalence(result.mean, 5), Number.Equivalence(result.count, 4)),
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
  return Estimators.summaryStatistics(values)
}

/**
 * Computes Bessel-corrected sample covariance.
 *
 * @remarks
 * Equal lengths are a caller precondition. If the lengths differ, each mean
 * uses its full sample, paired deviations stop at the shorter sample, and the
 * denominator is one less than the size of `a`. An empty `a` returns negative zero. A
 * singleton `a` returns `NaN`; when `a` has at least two observations and `b`
 * is empty, the result is zero.
 *
 * @param a - First sample, whose size determines the denominator.
 * @param b - Second sample paired with `a` by position.
 * @returns The sum of paired deviation products divided by one less than the size of `a`.
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
 * @throws {@link DecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
 * @since 0.1.0
 * @category operations
 */
export const meanValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "mean",
          message: error.message
        })
      )
    )

    return Estimators.mean(decoded.values)
  })

/**
 * Decodes a finite sample and computes Bessel-corrected variance.
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns The sample variance for two or more observations.
 * @throws {@link DecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
 * @throws {@link ShapeError} in the Effect error channel when the decoded sample has one observation.
 * @since 0.1.0
 * @category operations
 */
export const varianceValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "variance",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.greaterThanOrEqualTo(Chunk.size(d.values), 2),
      () =>
        new ShapeError({
          operation: "variance",
          expected: "at least 2 samples",
          actual: String.concat(encodeNumber(Chunk.size(decoded.values)), " sample(s)"),
          message: "Bessel-corrected variance requires at least 2 samples"
        })
    )

    return Estimators.variance(decoded.values)
  })

/**
 * Decodes a finite sample and computes its descriptive summary.
 *
 * @example
 * ```ts
 * import { Array, Boolean, Effect, Number } from "effect"
 * import { Statistics } from "@scenesystems/effect-math"
 *
 * export const program = Statistics.summaryStatisticsValidated({
 *   values: Array.make(2, 4, 6, 8)
 * }).pipe(
 *   Effect.filterOrFail(
 *     (result) => Boolean.and(Number.Equivalence(result.mean, 5), Number.Equivalence(result.count, 4)),
 *     () => "UnexpectedSummary"
 *   )
 * )
 * ```
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns A new tagged summary using Bessel-corrected variance.
 * @throws {@link DecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
 * @throws {@link ShapeError} in the Effect error channel when the decoded sample has one observation.
 * @since 0.1.0
 * @category operations
 */
export const summaryStatisticsValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "summaryStatistics",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.greaterThanOrEqualTo(Chunk.size(d.values), 2),
      () =>
        new ShapeError({
          operation: "summaryStatistics",
          expected: "at least 2 samples",
          actual: String.concat(encodeNumber(Chunk.size(decoded.values)), " sample(s)"),
          message: "Summary statistics requires at least 2 samples for variance"
        })
    )

    const chunk = decoded.values
    const m = Estimators.mean(chunk)
    const v = Estimators.variance(chunk)
    const sd = sqrt(v)
    const first = Chunk.headNonEmpty(chunk)
    const minVal = Chunk.reduce(chunk, first, Number.min)
    const maxVal = Chunk.reduce(chunk, first, Number.max)

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
 * @throws {@link DecodeError} in the Effect error channel when either sample is missing, empty, or non-finite.
 * @throws {@link ShapeError} in the Effect error channel when the samples differ in length or contain fewer than two observations.
 * @since 0.1.0
 * @category operations
 */
export const covarianceValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(TwoSampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "covariance",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.Equivalence(Chunk.size(d.a), Chunk.size(d.b)),
      (d) =>
        new ShapeError({
          operation: "covariance",
          expected: String.concat("length ", encodeNumber(Chunk.size(d.a))),
          actual: String.concat("length ", encodeNumber(Chunk.size(d.b))),
          message: "Covariance requires samples of equal length"
        })
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.greaterThanOrEqualTo(Chunk.size(d.a), 2),
      () =>
        new ShapeError({
          operation: "covariance",
          expected: "at least 2 samples",
          actual: String.concat(encodeNumber(Chunk.size(decoded.a)), " sample(s)"),
          message: "Bessel-corrected covariance requires at least 2 samples"
        })
    )

    return Estimators.covariance(decoded.a, decoded.b)
  })

/**
 * Decodes a non-empty finite sample and finds its minimum.
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns The minimum in `Option.some()`; successful decoding rules out `Option.none()`.
 * @throws {@link DecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
 * @since 0.1.0
 * @category operations
 */
export const minimumValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "minimum",
          message: error.message
        })
      )
    )

    return Estimators.minimum(decoded.values)
  })

/**
 * Decodes a non-empty finite sample and finds its maximum.
 *
 * @param input - Untrusted input decoded by {@link SampleInput}; excess fields are rejected.
 * @returns The maximum in `Option.some()`; successful decoding rules out `Option.none()`.
 * @throws {@link DecodeError} in the Effect error channel when the input is malformed, empty, or non-finite.
 * @since 0.1.0
 * @category operations
 */
export const maximumValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SampleInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "maximum",
          message: error.message
        })
      )
    )

    return Estimators.maximum(decoded.values)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Computes a descriptive summary under runtime precision and diagnostics policies.
 *
 * @remarks
 * The input is not decoded. At least two observations are required. Strict
 * precision rejects non-finite calculations before returning a result.
 * Relaxed precision still obeys the canonical finite {@link SummaryStatistics}
 * result schema, so a non-finite field is a typed domain violation rather than
 * a successful relaxed result. Enabled diagnostics emit one debug log only
 * after result validation, containing the precision mode and sample size. This
 * operation requires {@link Policy.Precision} and {@link Policy.Diagnostics}.
 *
 * @example
 * ```ts
 * import { Boolean, Chunk, Effect, Layer, Number } from "effect"
 * import { Statistics } from "@scenesystems/effect-math"
 * import * as Policy from "@scenesystems/effect-math/Policy"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(Policy.Precision, { policy: "strict" }),
 *   Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
 * )
 *
 * export const program = Statistics.summaryStatisticsWithPolicies(
 *   Chunk.make(2, 4, 6, 8)
 * ).pipe(
 *   Effect.provide(policies),
 *   Effect.filterOrFail(
 *     (result) => Boolean.and(Number.Equivalence(result.mean, 5), Number.Equivalence(result.count, 4)),
 *     () => "UnexpectedSummary"
 *   )
 * )
 * ```
 *
 * @param values - Observations used without finite-number validation.
 * @returns A new tagged summary using Bessel-corrected variance.
 * @throws {@link ShapeError} in the Effect error channel for fewer than two observations.
 * @throws {@link DomainViolationError} in the Effect error channel when either precision mode produces a result that violates the finite summary schema.
 * @since 0.1.0
 * @category operations
 */
export const summaryStatisticsWithPolicies = (values: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    const precision = yield* Policy.Precision
    const diagnostics = yield* Policy.Diagnostics

    yield* Effect.filterOrFail(
      Effect.succeed(Chunk.size(values)),
      Number.greaterThanOrEqualTo(2),
      (n) =>
        new ShapeError({
          operation: "summaryStatisticsWithPolicies",
          expected: "at least 2 samples",
          actual: String.concat(encodeNumber(n), " sample(s)"),
          message: "Summary statistics requires at least 2 samples for variance"
        })
    )

    const m = Estimators.mean(values)
    const v = Estimators.variance(values)
    const sd = sqrt(v)
    const first = Chunk.unsafeHead(values)
    const minVal = Chunk.reduce(values, first, Number.min)
    const maxVal = Chunk.reduce(values, first, Number.max)
    const count = Chunk.size(values)

    const result = yield* Schema.decodeUnknown(SummaryStatistics)(
      {
        _tag: "SummaryStatistics",
        mean: m,
        variance: v,
        standardDeviation: sd,
        min: minVal,
        max: maxVal,
        count
      },
      { onExcessProperty: "error" }
    ).pipe(
      Effect.mapError((error) =>
        new DomainViolationError({
          operation: "summaryStatisticsWithPolicies",
          message: String.concat("Summary statistics result violates the finite schema: ", error.message)
        })
      )
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.logDebug("Statistics.summaryStatisticsWithPolicies").pipe(
          Effect.annotateLogs({
            precision: precision.policy,
            sampleSize: encodeNumber(count)
          })
        )),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Computes an arithmetic mean under runtime precision and diagnostics policies.
 *
 * @remarks
 * The sample is not decoded, and an empty sample reaches the estimator as
 * `NaN`. Strict precision rejects any non-finite result. Enabled diagnostics
 * emit one debug log containing the precision mode, sample size, result, and
 * elapsed milliseconds. This operation requires {@link Policy.Precision}
 * and {@link Policy.Diagnostics}.
 *
 * @param values - Observations used without shape or finite-number validation.
 * @returns The arithmetic mean, including `NaN` under relaxed precision for an empty sample.
 * @throws {@link DomainViolationError} in the Effect error channel when strict precision rejects a non-finite result.
 * @since 0.1.0
 * @category operations
 */
export const meanWithPolicies = (values: Chunk.Chunk<number>) =>
  PolicyGuard.scalar({
    operation: "Statistics.meanWithPolicies",
    compute: () => Estimators.mean(values),
    makeError: (message) => new DomainViolationError({ operation: "meanWithPolicies", message }),
    annotations: (result) => ({ sampleSize: encodeNumber(Chunk.size(values)), result: encodeNumber(result) })
  })

/**
 * Computes Bessel-corrected variance under runtime precision and diagnostics policies.
 *
 * @remarks
 * The operation accepts the sample directly and requires at least two
 * observations. Strict precision rejects a non-finite result. Enabled
 * diagnostics emit one debug log containing the precision mode, sample size,
 * result, and elapsed milliseconds. This operation requires
 * {@link Policy.Precision} and {@link Policy.Diagnostics}.
 *
 * @param values - Observations used without finite-number validation.
 * @returns The sample variance for two or more observations.
 * @throws {@link ShapeError} in the Effect error channel for fewer than two observations.
 * @throws {@link DomainViolationError} in the Effect error channel when strict precision rejects a non-finite result.
 * @since 0.1.0
 * @category operations
 */
export const varianceWithPolicies = (values: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    yield* Effect.filterOrFail(
      Effect.succeed(Chunk.size(values)),
      Number.greaterThanOrEqualTo(2),
      (n) =>
        new ShapeError({
          operation: "varianceWithPolicies",
          expected: "at least 2 samples",
          actual: String.concat(encodeNumber(n), " sample(s)"),
          message: "Bessel-corrected variance requires at least 2 samples"
        })
    )
    return yield* PolicyGuard.scalar({
      operation: "Statistics.varianceWithPolicies",
      compute: () => Estimators.variance(values),
      makeError: (message) => new DomainViolationError({ operation: "varianceWithPolicies", message }),
      annotations: (result) => ({ sampleSize: encodeNumber(Chunk.size(values)), result: encodeNumber(result) })
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
 * {@link Policy.Precision} and {@link Policy.Diagnostics}.
 *
 * @param a - First sample, paired with `b` by position.
 * @param b - Second sample, which must match the length of `a`.
 * @returns The covariance of the paired observations.
 * @throws {@link ShapeError} in the Effect error channel when lengths differ or either sample contains fewer than two observations.
 * @throws {@link DomainViolationError} in the Effect error channel when strict precision rejects a non-finite result.
 * @since 0.1.0
 * @category operations
 */
export const covarianceWithPolicies = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    yield* Effect.filterOrFail(
      Effect.succeed({ aLen: Chunk.size(a), bLen: Chunk.size(b) }),
      ({ aLen, bLen }) => Number.Equivalence(aLen, bLen),
      ({ aLen, bLen }) =>
        new ShapeError({
          operation: "covarianceWithPolicies",
          expected: String.concat("length ", encodeNumber(aLen)),
          actual: String.concat("length ", encodeNumber(bLen)),
          message: "Covariance requires samples of equal length"
        })
    )

    yield* Effect.filterOrFail(
      Effect.succeed(Chunk.size(a)),
      Number.greaterThanOrEqualTo(2),
      (n) =>
        new ShapeError({
          operation: "covarianceWithPolicies",
          expected: "at least 2 samples",
          actual: String.concat(encodeNumber(n), " sample(s)"),
          message: "Bessel-corrected covariance requires at least 2 samples"
        })
    )

    return yield* PolicyGuard.scalar({
      operation: "Statistics.covarianceWithPolicies",
      compute: () => Estimators.covariance(a, b),
      makeError: (message) => new DomainViolationError({ operation: "covarianceWithPolicies", message }),
      annotations: (result) => ({ sampleSize: encodeNumber(Chunk.size(a)), result: encodeNumber(result) })
    })
  })
