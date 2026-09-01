/**
 * Distances and point aggregates over `Chunk` coordinates, with validated
 * and policy-aware variants for untrusted inputs.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Match, Number as N, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { GeometryDecodeError, GeometryDomainViolationError, GeometryShapeMismatchError } from "./errors.js"
import * as Metric from "./internal/metric.js"
import { GeometryDomainModel } from "./model.js"
import { CentroidInput, DistanceInput, MidpointInput } from "./schema.js"

/**
 * Returns the canonical provisional Geometry descriptor for registration or
 * capability discovery, without service requirements or a failure channel.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadGeometryDomain = Effect.succeed(GeometryDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports — operate on Chunk<number>
// ---------------------------------------------------------------------------

/**
 * Euclidean (L2) distance — `√(Σ (aᵢ − bᵢ)²)`. Both chunks must have the
 * same length. Because `Chunk.zipWith` truncates, unequal pure inputs use
 * only their shared prefix; use {@link distanceValidated} to reject that case.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { Geometry } from "@scenesystems/effect-math"
 *
 * Geometry.euclideanDistance(
 *   Chunk.fromIterable([0, 0]),
 *   Chunk.fromIterable([3, 4])
 * ) // 5
 * ```
 *
 * @see {@link distanceValidated} for Schema-validated boundary input with shape checking
 * @see {@link distanceWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const euclideanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.euclideanDistance

/**
 * Squared Euclidean distance — `Σ (aᵢ − bᵢ)²` without the square root.
 * Useful for optimization kernels where only relative distances matter.
 * Unequal pure inputs use only their shared prefix; use
 * {@link distanceValidated} to reject that case.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { Geometry } from "@scenesystems/effect-math"
 *
 * Geometry.squaredEuclideanDistance(
 *   Chunk.fromIterable([0, 0]),
 *   Chunk.fromIterable([3, 4])
 * ) // 25
 * ```
 *
 * @see {@link euclideanDistance} for the rooted L2 metric
 * @see {@link distanceValidated} for Schema-validated boundary input
 * @since 0.1.0
 * @category operations
 */
export const squaredEuclideanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number =
  Metric.squaredEuclideanDistance

/**
 * Manhattan (L1 / taxicab) distance — `Σ |aᵢ − bᵢ|`. Both chunks must have
 * the same length. Unequal pure inputs use only their shared prefix.
 *
 * @see {@link distanceValidated} for Schema-validated boundary input with metric dispatch
 * @see {@link distanceWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const manhattanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.manhattanDistance

/**
 * Chebyshev (L∞) distance — `max |aᵢ − bᵢ|`. Both chunks must have the
 * same length. Unequal pure inputs use only their shared prefix.
 *
 * @see {@link distanceValidated} for Schema-validated boundary input with metric dispatch
 * @see {@link distanceWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const chebyshevDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.chebyshevDistance

/**
 * Elementwise midpoint — `mᵢ = (aᵢ + bᵢ) / 2`. Returns a new `Chunk`; the
 * inputs are not mutated. Unequal pure inputs use only their shared prefix;
 * {@link midpointValidated} rejects unequal dimensions.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { Geometry } from "@scenesystems/effect-math"
 *
 * Chunk.toReadonlyArray(
 *   Geometry.midpoint(
 *     Chunk.fromIterable([0, 0]),
 *     Chunk.fromIterable([4, 6])
 *   )
 * ) // [2, 3]
 * ```
 *
 * @see {@link midpointValidated} for Schema-validated boundary input
 * @since 0.1.0
 * @category operations
 */
export const midpoint: (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Metric.midpoint

// ---------------------------------------------------------------------------
// Schema-validated operations with boundary input checking
// ---------------------------------------------------------------------------

/**
 * Computes a boundary-validated distance between two points.
 *
 * @remarks
 * Decodes `input` through `DistanceInput`, validates equal-length points, and
 * dispatches to the correct metric kernel (euclidean, manhattan, or
 * chebyshev) via `Match.exhaustive`. Fails with `GeometryDecodeError` for
 * malformed input or `GeometryShapeMismatchError` for mismatched point
 * dimensions.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Geometry } from "@scenesystems/effect-math"
 *
 * const program = Geometry.distanceValidated({
 *   a: [0, 0], b: [3, 4], metric: "euclidean"
 * }).pipe(
 *   Effect.catchTag("GeometryShapeMismatchError", (e) =>
 *     Effect.succeed(`dimension error: ${e.message}`)
 *   )
 * )
 * ```
 *
 * @see {@link euclideanDistance} / {@link manhattanDistance} / {@link chebyshevDistance} for pure kernels
 * @see {@link distanceWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const distanceValidated = (input: unknown) =>
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
 * Boundary-validated midpoint — decodes `input` through `MidpointInput`,
 * validates equal-length points, and computes `mᵢ = (aᵢ + bᵢ) / 2`.
 * Returns the result as `ReadonlyArray<number>`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Geometry } from "@scenesystems/effect-math"
 *
 * const program = Geometry.midpointValidated({ a: [0, 0], b: [4, 6] })
 * // Effect succeeds with [2, 3]
 * ```
 *
 * @see {@link midpoint} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const midpointValidated = (input: unknown) =>
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
 * Boundary-validated centroid — decodes `input` through `CentroidInput`,
 * validates that all points share the same dimensionality, and computes the
 * componentwise arithmetic mean. Returns `ReadonlyArray<number>`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Geometry } from "@scenesystems/effect-math"
 *
 * const program = Geometry.centroidValidated({
 *   points: [[0, 0], [4, 6], [2, 3]]
 * })
 * // Effect succeeds with [2, 3]
 * ```
 *
 * @see {@link midpointValidated} for the two-point special case
 * @since 0.1.0
 * @category operations
 */
export const centroidValidated = (input: unknown) =>
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
 * context:
 *
 * @remarks
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite results with `GeometryDomainViolationError`; `"relaxed"` passes through
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug` with metric, precision, dimensionality, and elapsed time
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   Geometry,
 *   PrecisionPolicyService
 * } from "@scenesystems/effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = Geometry.distanceWithPolicies(
 *   Chunk.fromIterable([0, 0]),
 *   Chunk.fromIterable([3, 4]),
 *   "euclidean"
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link euclideanDistance} / {@link manhattanDistance} / {@link chebyshevDistance} for pure kernels
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const distanceWithPolicies = (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>,
  metric: "euclidean" | "manhattan" | "chebyshev"
) =>
  withScalarPolicyGuards({
    operation: "Geometry.distanceWithPolicies",
    compute: () =>
      Match.value(metric).pipe(
        Match.when("euclidean", () => Metric.euclideanDistance(a, b)),
        Match.when("manhattan", () => Metric.manhattanDistance(a, b)),
        Match.when("chebyshev", () => Metric.chebyshevDistance(a, b)),
        Match.exhaustive
      ),
    makeError: (message) => new GeometryDomainViolationError({ operation: "distanceWithPolicies", message }),
    annotations: (result) => ({
      metric,
      dimensionality: String(Chunk.size(a)),
      result: String(result)
    })
  })
