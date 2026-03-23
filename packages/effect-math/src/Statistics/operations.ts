/**
 * Statistics operation surface — pure kernel re-exports over immutable
 * `Chunk` carriers, Effect-wrapped variants with Schema-validated boundary
 * input, and policy-aware operations that respect `PrecisionPolicyService`
 * and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Match, Option, Schema } from "effect"

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
 * Arithmetic mean of a non-empty chunk.
 *
 * @since 0.1.0
 * @category operations
 */
export const mean: (values: Chunk.Chunk<number>) => number = Estimators.mean

/**
 * Sample variance (Bessel-corrected, n-1 denominator).
 *
 * @since 0.1.0
 * @category operations
 */
export const variance: (values: Chunk.Chunk<number>) => number = Estimators.variance

/**
 * Sample standard deviation — `√(variance)`.
 *
 * @since 0.1.0
 * @category operations
 */
export const standardDeviation: (values: Chunk.Chunk<number>) => number = Estimators.standardDeviation

/**
 * Covariance of two equal-length chunks (Bessel-corrected, n-1 denominator).
 *
 * @since 0.1.0
 * @category operations
 */
export const covariance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Estimators.covariance

// ---------------------------------------------------------------------------
// Effect-wrapped operations with schema-validated input
// ---------------------------------------------------------------------------

/**
 * Effect-wrapped mean that decodes `input` through `SampleInput` and
 * computes the arithmetic mean. Fails with `StatisticsDecodeError` for
 * malformed input.
 *
 * @since 0.1.0
 * @category operations
 */
export const meanEffect = (input: unknown) =>
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
 * Effect-wrapped variance that decodes `input` through `SampleInput`,
 * validates at least 2 samples for Bessel correction, and computes
 * the sample variance. Fails with `StatisticsDecodeError` for malformed
 * input or `StatisticsShapeError` for insufficient data.
 *
 * @since 0.1.0
 * @category operations
 */
export const varianceEffect = (input: unknown) =>
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
 * Effect-wrapped summary statistics that decodes `input` through
 * `SampleInput`, validates at least 2 samples, computes mean, variance,
 * standard deviation, min, max, and count, and returns a `SummaryStatistics`
 * TaggedClass instance.
 *
 * @since 0.1.0
 * @category operations
 */
export const summaryStatisticsEffect = (input: unknown) =>
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
 * Effect-wrapped covariance that decodes `input` through `TwoSampleInput`,
 * validates equal-length samples with at least 2 observations, and computes
 * the Bessel-corrected covariance.
 *
 * @since 0.1.0
 * @category operations
 */
export const covarianceEffect = (input: unknown) =>
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

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware summary statistics that reads `PrecisionPolicyService` and
 * `DiagnosticsPolicyService` from the Effect context. Under `"strict"`
 * precision, rejects non-finite results with `StatisticsDomainViolationError`.
 * Under `"enabled"` diagnostics, emits `Effect.logDebug` with metadata.
 *
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
