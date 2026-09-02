/**
 * Validates Geometry discovery metadata and operation inputs at untrusted boundaries.
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
 * Descriptor schema used to advertise metric and point-set Geometry support
 * in domain-discovery results.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GeometryDomainSchema = Schema.Struct({
  domain: Schema.Literal("Geometry"),
  stability: DomainStability
})

/**
 * Validated descriptor for metric and point-set Geometry support.
 *
 * @since 0.1.0
 * @category models
 */
export type GeometryDomain = typeof GeometryDomainSchema.Type

/**
 * Decodes a Geometry discovery descriptor and rejects unknown fields.
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
 * Encodes a validated Geometry discovery descriptor, failing for forged values.
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
 * Error channel shared by Geometry descriptor ingestion and serialization.
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
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Accepts finite point coordinates and selects Euclidean, Manhattan, or
 * Chebyshev distance. Equal dimensionality is checked by
 * `distanceValidated`, not by this schema.
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
 * Accepts two points containing only finite coordinates. Equal dimensionality
 * is checked by `midpointValidated`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const MidpointInput = Schema.Struct({
  a: Schema.Array(FiniteNumber),
  b: Schema.Array(FiniteNumber)
}).annotations({ identifier: "MidpointInput" })

/**
 * Accepts a non-empty point collection containing only finite coordinates.
 * Equal dimensionality is checked by `centroidValidated`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CentroidInput = Schema.Struct({
  points: Schema.NonEmptyArray(Schema.Array(FiniteNumber))
}).annotations({ identifier: "CentroidInput" })
