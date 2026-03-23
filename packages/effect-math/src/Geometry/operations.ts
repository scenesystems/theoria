/**
 * Geometry operation surface — pure kernel re-exports over immutable
 * `Chunk` carriers, Effect-wrapped variants with Schema-validated boundary
 * input, and policy-aware operations that respect `PrecisionPolicyService`
 * and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Clock, Effect, Match, Number as N, Schema } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { GeometryDecodeError, GeometryDomainViolationError, GeometryShapeMismatchError } from "./errors.js"
import * as Metric from "./internal/metric.js"
import { GeometryDomainModel } from "./model.js"
import { CentroidInput, DistanceInput, MidpointInput } from "./schema.js"

/**
 * Lifts the static `GeometryDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadGeometryDomain = Effect.succeed(GeometryDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports — operate on Chunk<number>
// ---------------------------------------------------------------------------

/**
 * Euclidean distance between two equal-length `Chunk` carriers:
 * `√(Σ (aᵢ − bᵢ)²)`. No runtime guard is applied — use `distanceEffect`
 * for validated input.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { euclideanDistance } from "./operations.js"
 *
 * euclideanDistance(
 *   Chunk.fromIterable([0, 0]),
 *   Chunk.fromIterable([3, 4])
 * ) // 5
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const euclideanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.euclideanDistance

/**
 * Manhattan distance between two equal-length `Chunk` carriers:
 * `Σ |aᵢ − bᵢ|`. No runtime guard is applied.
 *
 * @since 0.1.0
 * @category operations
 */
export const manhattanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.manhattanDistance

/**
 * Chebyshev distance between two equal-length `Chunk` carriers:
 * `max |aᵢ − bᵢ|`. No runtime guard is applied.
 *
 * @since 0.1.0
 * @category operations
 */
export const chebyshevDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.chebyshevDistance

/**
 * Elementwise midpoint of two equal-length `Chunk` carriers:
 * `(aᵢ + bᵢ) / 2`. Returns a new `Chunk` — the inputs are not mutated.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { midpoint } from "./operations.js"
 *
 * Chunk.toReadonlyArray(
 *   midpoint(
 *     Chunk.fromIterable([0, 0]),
 *     Chunk.fromIterable([4, 6])
 *   )
 * ) // [2, 3]
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const midpoint: (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Metric.midpoint

// ---------------------------------------------------------------------------
// Effect-wrapped operations with schema-validated input
// ---------------------------------------------------------------------------

/**
 * Effect-wrapped distance computation that decodes `input` through
 * `DistanceInput`, validates equal-length points, and dispatches to the
 * correct metric kernel via `Match.exhaustive`. Fails with
 * `GeometryDecodeError` for malformed input or `GeometryShapeMismatchError`
 * for mismatched point dimensions.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { distanceEffect } from "./operations.js"
 *
 * const program = distanceEffect({
 *   a: [0, 0], b: [3, 4], metric: "euclidean"
 * }).pipe(
 *   Effect.catchTag("GeometryShapeMismatchError", (e) =>
 *     Effect.succeed(`dimension error: ${e.message}`)
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const distanceEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DistanceInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new GeometryDecodeError({
          operation: "distance",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.Equivalence(d.a.length, d.b.length),
      (d) =>
        new GeometryShapeMismatchError({
          operation: "distance",
          expected: `length ${d.a.length}`,
          actual: `length ${d.b.length}`,
          message: `Distance requires points of equal dimensionality`
        })
    )

    const a = Chunk.fromIterable(decoded.a)
    const b = Chunk.fromIterable(decoded.b)

    return Match.value(decoded.metric).pipe(
      Match.when("euclidean", () => Metric.euclideanDistance(a, b)),
      Match.when("manhattan", () => Metric.manhattanDistance(a, b)),
      Match.when("chebyshev", () => Metric.chebyshevDistance(a, b)),
      Match.exhaustive
    )
  })

/**
 * Effect-wrapped midpoint that decodes `input` through `MidpointInput`,
 * validates equal-length points, and computes the elementwise midpoint.
 * Returns the result as a `ReadonlyArray<number>`.
 *
 * @since 0.1.0
 * @category operations
 */
export const midpointEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(MidpointInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new GeometryDecodeError({
          operation: "midpoint",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.Equivalence(d.a.length, d.b.length),
      (d) =>
        new GeometryShapeMismatchError({
          operation: "midpoint",
          expected: `length ${d.a.length}`,
          actual: `length ${d.b.length}`,
          message: `Midpoint requires points of equal dimensionality`
        })
    )

    return Chunk.toReadonlyArray(
      Metric.midpoint(Chunk.fromIterable(decoded.a), Chunk.fromIterable(decoded.b))
    )
  })

/**
 * Effect-wrapped centroid that decodes `input` through `CentroidInput`,
 * validates that all points have equal dimensionality, and computes the
 * arithmetic mean. Returns the result as a `ReadonlyArray<number>`.
 *
 * @since 0.1.0
 * @category operations
 */
export const centroidEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(CentroidInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new GeometryDecodeError({
          operation: "centroid",
          message: error.message
        })
      )
    )

    const firstLength = decoded.points[0].length

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => d.points.every((pt) => N.Equivalence(pt.length, firstLength)),
      () =>
        new GeometryShapeMismatchError({
          operation: "centroid",
          expected: `all points length ${firstLength}`,
          actual: `mixed lengths`,
          message: `Centroid requires all points to have equal dimensionality`
        })
    )

    const chunkPoints = Chunk.map(
      Chunk.fromIterable(decoded.points),
      Chunk.fromIterable
    )

    return Chunk.toReadonlyArray(Metric.centroid(chunkPoints))
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware distance computation that reads two runtime services from
 * the Effect context:
 *
 * - **PrecisionPolicyService** — when `"strict"`, rejects non-finite results
 *   with `GeometryDomainViolationError`
 * - **DiagnosticsPolicyService** — when `"enabled"`, emits `Effect.logDebug`
 *   with timing and policy metadata
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import { distanceWithPolicies } from "./operations.js"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "../contracts/shared/RuntimePolicies.js"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = distanceWithPolicies(
 *   Chunk.fromIterable([0, 0]),
 *   Chunk.fromIterable([3, 4]),
 *   "euclidean"
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const distanceWithPolicies = (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>,
  metric: "euclidean" | "manhattan" | "chebyshev"
) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = Match.value(metric).pipe(
      Match.when("euclidean", () => Metric.euclideanDistance(a, b)),
      Match.when("manhattan", () => Metric.manhattanDistance(a, b)),
      Match.when("chebyshev", () => Metric.chebyshevDistance(a, b)),
      Match.exhaustive
    )

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new GeometryDomainViolationError({
              operation: "distanceWithPolicies",
              message: `Non-finite distance result: ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Geometry.distanceWithPolicies").pipe(
            Effect.annotateLogs({
              metric,
              precision: precision.policy,
              dimensionality: String(Chunk.size(a)),
              elapsedMs: String(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })
