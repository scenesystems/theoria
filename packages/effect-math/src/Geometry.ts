/**
 * Geometry schemas, errors, distances, and point aggregates over `Chunk` coordinates.
 *
 * @since 0.1.0
 * @module
 */
import { Chunk, Effect, Match, Number, Schema, String } from "effect"
import { dual } from "effect/Function"

import * as Metric from "./internal/geometry/metric.js"
import * as PolicyGuard from "./internal/policyGuard.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const point = Schema.Chunk(Schema.Finite)
const pointPair = Schema.Struct({ a: point, b: point })

/** Two finite points and a supported distance metric.
 * @since 0.1.0
 * @category schemas
 */
export const DistanceInput = Schema.extend(
  pointPair,
  Schema.Struct({ metric: Schema.Literal("euclidean", "manhattan", "chebyshev") })
).annotations({ identifier: "@scenesystems/effect-math/Geometry/DistanceInput" })

/** Two finite points for midpoint calculation.
 * @since 0.1.0
 * @category schemas
 */
export const MidpointInput = pointPair.annotations({
  identifier: "@scenesystems/effect-math/Geometry/MidpointInput"
})

/** Non-empty finite point collection for centroid calculation.
 * @since 0.1.0
 * @category schemas
 */
export const CentroidInput = Schema.Struct({ points: Schema.NonEmptyChunk(point) }).annotations({
  identifier: "@scenesystems/effect-math/Geometry/CentroidInput"
})

/**
 * Decoded distance input.
 * @since 0.1.0
 * @category models
 */
export type DistanceInput = typeof DistanceInput.Type
/**
 * Decoded midpoint input.
 * @since 0.1.0
 * @category models
 */
export type MidpointInput = typeof MidpointInput.Type
/**
 * Decoded centroid input.
 * @since 0.1.0
 * @category models
 */
export type CentroidInput = typeof CentroidInput.Type

/** Malformed validated-operation input.
 * @since 0.1.0
 * @category errors
 */
export class DecodeError
  extends Schema.TaggedError<DecodeError>("@scenesystems/effect-math/Geometry/DecodeError")("GeometryDecodeError", {
    operation: Schema.Literal("distance", "midpoint", "centroid"),
    message: Schema.String
  })
{}

/** Incompatible point dimensions.
 * @since 0.1.0
 * @category errors
 */
export class ShapeMismatchError
  extends Schema.TaggedError<ShapeMismatchError>("@scenesystems/effect-math/Geometry/ShapeMismatchError")(
    "GeometryShapeMismatchError",
    {
      operation: Schema.Literal("distance", "midpoint", "centroid"),
      expected: Schema.String,
      actual: Schema.String,
      message: Schema.String
    }
  )
{}

/** Non-finite result rejected by strict precision.
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError
  extends Schema.TaggedError<DomainViolationError>("@scenesystems/effect-math/Geometry/DomainViolationError")(
    "GeometryDomainViolationError",
    {
      operation: Schema.Literal("distanceWithPolicies"),
      message: Schema.String
    }
  )
{}

/** Recoverable Geometry operation failures.
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | ShapeMismatchError | DomainViolationError

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
export const euclideanDistance: {
  (that: Chunk.Chunk<number>): (self: Chunk.Chunk<number>) => number
  (self: Chunk.Chunk<number>, that: Chunk.Chunk<number>): number
} = dual(2, Metric.euclideanDistance)

/**
 * Computes squared Euclidean distance as `Σ (aᵢ - bᵢ)²`, avoiding the square
 * root when a caller only compares distances.
 * Unequal pure inputs use only their shared prefix; use
 * {@link distanceValidated} to reject that case.
 * @since 0.1.0
 * @category operations
 */
export const squaredEuclideanDistance: {
  (that: Chunk.Chunk<number>): (self: Chunk.Chunk<number>) => number
  (self: Chunk.Chunk<number>, that: Chunk.Chunk<number>): number
} = dual(2, Metric.squaredEuclideanDistance)

/**
 * Computes Manhattan distance as `Σ |aᵢ - bᵢ|`. Both chunks must have
 * the same length. Unequal pure inputs use only their shared prefix.
 * @since 0.1.0
 * @category operations
 */
export const manhattanDistance: {
  (that: Chunk.Chunk<number>): (self: Chunk.Chunk<number>) => number
  (self: Chunk.Chunk<number>, that: Chunk.Chunk<number>): number
} = dual(2, Metric.manhattanDistance)

/**
 * Computes Chebyshev distance as `max |aᵢ - bᵢ|`. Both chunks must have the
 * same length. Unequal pure inputs use only their shared prefix.
 * @since 0.1.0
 * @category operations
 */
export const chebyshevDistance: {
  (that: Chunk.Chunk<number>): (self: Chunk.Chunk<number>) => number
  (self: Chunk.Chunk<number>, that: Chunk.Chunk<number>): number
} = dual(2, Metric.chebyshevDistance)

/**
 * Computes the elementwise midpoint `mᵢ = (aᵢ + bᵢ) / 2`. Returns a new `Chunk`; the
 * inputs are not mutated. Unequal pure inputs use only their shared prefix;
 * {@link midpointValidated} rejects unequal dimensions.
 * @since 0.1.0
 * @category operations
 */
export const midpoint: {
  (that: Chunk.Chunk<number>): (self: Chunk.Chunk<number>) => Chunk.Chunk<number>
  (self: Chunk.Chunk<number>, that: Chunk.Chunk<number>): Chunk.Chunk<number>
} = dual(2, Metric.midpoint)

/** Computes the componentwise arithmetic mean of a non-empty point collection.
 * @since 0.1.0
 * @category operations
 */
export const centroid: (points: Chunk.NonEmptyChunk<Chunk.Chunk<number>>) => Chunk.Chunk<number> = Metric.centroid

// ---------------------------------------------------------------------------
// Schema-validated operations with boundary input checking
// ---------------------------------------------------------------------------

/**
 * Decodes two finite points and computes the selected distance. Malformed or
 * excess input fails with `DecodeError`; unequal dimensions fail with
 * `ShapeMismatchError`.
 * @since 0.1.0
 * @category operations
 */
export const distanceValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DistanceInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "distance",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.Equivalence(Chunk.size(d.a), Chunk.size(d.b)),
      (d) =>
        new ShapeMismatchError({
          operation: "distance",
          expected: String.concat("length ", encodeNumber(Chunk.size(d.a))),
          actual: String.concat("length ", encodeNumber(Chunk.size(d.b))),
          message: `Distance requires points of equal dimensionality`
        })
    )

    return Match.value(decoded.metric).pipe(
      Match.when("euclidean", () => Metric.euclideanDistance(decoded.a, decoded.b)),
      Match.when("manhattan", () => Metric.manhattanDistance(decoded.a, decoded.b)),
      Match.when("chebyshev", () => Metric.chebyshevDistance(decoded.a, decoded.b)),
      Match.exhaustive
    )
  })

/**
 * Decodes two finite points with equal dimensions and returns their midpoint
 * as an immutable `Chunk`. Malformed or excess input fails with
 * `DecodeError`; unequal dimensions fail with
 * `ShapeMismatchError`.
 * @since 0.1.0
 * @category operations
 */
export const midpointValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(MidpointInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "midpoint",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.Equivalence(Chunk.size(d.a), Chunk.size(d.b)),
      (d) =>
        new ShapeMismatchError({
          operation: "midpoint",
          expected: String.concat("length ", encodeNumber(Chunk.size(d.a))),
          actual: String.concat("length ", encodeNumber(Chunk.size(d.b))),
          message: `Midpoint requires points of equal dimensionality`
        })
    )

    return Metric.midpoint(decoded.a, decoded.b)
  })

/**
 * Decodes a non-empty collection of finite points and returns their
 * componentwise arithmetic mean. Malformed or excess input fails with
 * `DecodeError`; mixed dimensions fail with
 * `ShapeMismatchError`.
 * @since 0.1.0
 * @category operations
 */
export const centroidValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(CentroidInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "centroid",
          message: error.message
        })
      )
    )

    const firstLength = Chunk.size(Chunk.headNonEmpty(decoded.points))

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Chunk.every(d.points, (point) => Number.Equivalence(Chunk.size(point), firstLength)),
      () =>
        new ShapeMismatchError({
          operation: "centroid",
          expected: String.concat("all points length ", encodeNumber(firstLength)),
          actual: `mixed lengths`,
          message: `Centroid requires all points to have equal dimensionality`
        })
    )

    return Metric.centroid(decoded.points)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Computes the selected distance under the configured finite-result policy.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`; relaxed precision passes it through.
 * Enabled diagnostics logs the metric, precision, dimensionality, and elapsed
 * milliseconds. This variant does not reject unequal dimensions; the selected
 * pure operation uses the shared prefix.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer, Number } from "effect"
 * import { Geometry } from "@scenesystems/effect-math"
 * import * as Policy from "@scenesystems/effect-math/Policy"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(Policy.Precision, { policy: "strict" }),
 *   Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
 * )
 *
 * export const program = Geometry.distanceWithPolicies(
 *   Chunk.make(0, 0),
 *   Chunk.make(3, 4),
 *   "euclidean"
 * ).pipe(
 *   Effect.provide(policies),
 *   Effect.filterOrFail(
 *     (distance) => Number.Equivalence(distance, 5),
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
  metric: DistanceInput["metric"]
) =>
  PolicyGuard.scalar({
    operation: "Geometry.distanceWithPolicies",
    compute: () =>
      Match.value(metric).pipe(
        Match.when("euclidean", () => Metric.euclideanDistance(a, b)),
        Match.when("manhattan", () => Metric.manhattanDistance(a, b)),
        Match.when("chebyshev", () => Metric.chebyshevDistance(a, b)),
        Match.exhaustive
      ),
    makeError: (message) => new DomainViolationError({ operation: "distanceWithPolicies", message }),
    annotations: (result) => ({
      metric,
      dimensionality: encodeNumber(Chunk.size(a)),
      result: encodeNumber(result)
    })
  })
