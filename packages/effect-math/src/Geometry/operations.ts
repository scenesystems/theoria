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
 * Yields the immutable descriptor used to register Geometry capabilities.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadGeometryDomain = Effect.succeed(GeometryDomainModel)

// ---------------------------------------------------------------------------
// Pure operations over Chunk<number>
// ---------------------------------------------------------------------------

/**
 * Computes Euclidean distance as `√(Σ (aᵢ - bᵢ)²)`. Both chunks must have the
 * same length. Because `Chunk.zipWith` truncates, unequal pure inputs use
 * only their shared prefix; use {@link distanceValidated} to reject that case.
 * @since 0.1.0
 * @category operations
 */
export const euclideanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.euclideanDistance

/**
 * Computes squared Euclidean distance as `Σ (aᵢ - bᵢ)²`, avoiding the square
 * root when a caller only compares distances.
 * Unequal pure inputs use only their shared prefix; use
 * {@link distanceValidated} to reject that case.
 * @since 0.1.0
 * @category operations
 */
export const squaredEuclideanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number =
  Metric.squaredEuclideanDistance

/**
 * Computes Manhattan distance as `Σ |aᵢ - bᵢ|`. Both chunks must have
 * the same length. Unequal pure inputs use only their shared prefix.
 * @since 0.1.0
 * @category operations
 */
export const manhattanDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.manhattanDistance

/**
 * Computes Chebyshev distance as `max |aᵢ - bᵢ|`. Both chunks must have the
 * same length. Unequal pure inputs use only their shared prefix.
 * @since 0.1.0
 * @category operations
 */
export const chebyshevDistance: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Metric.chebyshevDistance

/**
 * Computes the elementwise midpoint `mᵢ = (aᵢ + bᵢ) / 2`. Returns a new `Chunk`; the
 * inputs are not mutated. Unequal pure inputs use only their shared prefix;
 * {@link midpointValidated} rejects unequal dimensions.
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
 * Decodes two finite points and computes the selected distance. Malformed or
 * excess input fails with `GeometryDecodeError`; unequal dimensions fail with
 * `GeometryShapeMismatchError`.
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
 * Decodes two finite points with equal dimensions and returns their midpoint
 * as an immutable array. Malformed or excess input fails with
 * `GeometryDecodeError`; unequal dimensions fail with
 * `GeometryShapeMismatchError`.
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
 * Decodes a non-empty collection of finite points and returns their
 * componentwise arithmetic mean. Malformed or excess input fails with
 * `GeometryDecodeError`; mixed dimensions fail with
 * `GeometryShapeMismatchError`.
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
 * Computes the selected distance under the configured finite-result policy.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `GeometryDomainViolationError`; relaxed precision passes it through.
 * Enabled diagnostics logs the metric, precision, dimensionality, and elapsed
 * milliseconds. This variant does not reject unequal dimensions; the selected
 * pure operation uses the shared prefix.
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
 * export const program = Geometry.distanceWithPolicies(
 *   Chunk.fromIterable([0, 0]),
 *   Chunk.fromIterable([3, 4]),
 *   "euclidean"
 * ).pipe(
 *   Effect.provide(policies),
 *   Effect.filterOrFail(
 *     (distance) => distance === 5,
 *     () => "UnexpectedDistance"
 *   )
 * )
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
