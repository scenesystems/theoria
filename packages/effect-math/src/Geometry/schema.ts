import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Geometry schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GeometryDomainSchema = Schema.Struct({
  domain: Schema.Literal("Geometry"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical geometry domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeGeometryDomain = (input: unknown) =>
  Schema.decodeUnknown(GeometryDomainSchema)(input).pipe(
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
 * Encodes the canonical geometry domain model at the package boundary.
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
 * Geometry boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type GeometrySchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Geometry schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type GeometryDomain = typeof GeometryDomainSchema.Type
