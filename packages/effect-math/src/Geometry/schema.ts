/**
 * Schema authority for the Geometry domain — defines the canonical domain
 * discriminator, operation input contracts, and boundary codec functions.
 * All schemas enforce finite-number validation at decode time, so kernels
 * can assume well-formed numeric input.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

/**
 * Canonical domain discriminator for Geometry. Consumers use this to
 * identify which domain produced a result when multiple domains coexist in
 * the same pipeline. The `stability` field tracks the domain's maturity level.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GeometryDomainSchema = Schema.Struct({
  domain: Schema.Literal("Geometry"),
  stability: DomainStability
})

/**
 * Extracted type of a decoded `GeometryDomainSchema` — use this in
 * function signatures that accept an already-validated domain descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type GeometryDomain = typeof GeometryDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical geometry domain model.
 * Uses strict excess-property checking — any properties beyond `domain` and
 * `stability` cause a `BoundaryDecodeError`. Use at package edges where
 * untrusted input enters the domain.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeGeometryDomain = (input: unknown) =>
  Schema.decodeUnknown(GeometryDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Geometry",
          contract: "GeometryDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes a validated `GeometryDomain` back to its serializable form at
 * the package boundary. Failures surface as `BoundaryEncodeError` — this
 * should only happen if the domain value was constructed outside of Schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeGeometryDomain = (domain: GeometryDomain) =>
  Schema.encode(GeometryDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Geometry",
          contract: "GeometryDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Union of all errors that can arise from boundary encode/decode operations
 * on the Geometry domain schema. Useful as a catch-all error channel type
 * in Effect pipelines that call `decodeGeometryDomain` or
 * `encodeGeometryDomain`.
 *
 * @since 0.1.0
 * @category errors
 */
export type GeometrySchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Shared finite number schema
// ---------------------------------------------------------------------------

const FiniteNumber = Schema.Number.pipe(Schema.finite())

// ---------------------------------------------------------------------------
// Operation input schemas — boundary decode contracts
// ---------------------------------------------------------------------------

/**
 * Boundary input contract for distance computation. Both `a` and `b` must
 * contain only finite numbers. The `metric` discriminator selects euclidean,
 * manhattan, or chebyshev distance. Decoded with strict excess-property
 * semantics — any extra fields cause a `GeometryDecodeError`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DistanceInput = Schema.Struct({
  a: Schema.Array(FiniteNumber),
  b: Schema.Array(FiniteNumber),
  metric: Schema.Literal("euclidean", "manhattan", "chebyshev")
}).annotations({ identifier: "DistanceInput" })

/**
 * Boundary input contract for midpoint computation. Both `a` and `b` must
 * contain only finite numbers. Decoded with strict excess-property
 * semantics — any extra fields cause a `GeometryDecodeError`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const MidpointInput = Schema.Struct({
  a: Schema.Array(FiniteNumber),
  b: Schema.Array(FiniteNumber)
}).annotations({ identifier: "MidpointInput" })

/**
 * Boundary input contract for centroid computation. The `points` array must
 * be non-empty and each point must contain only finite numbers. Decoded with
 * strict excess-property semantics — any extra fields cause a
 * `GeometryDecodeError`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CentroidInput = Schema.Struct({
  points: Schema.NonEmptyArray(Schema.Array(FiniteNumber))
}).annotations({ identifier: "CentroidInput" })
