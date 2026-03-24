/**
 * Special-functions schema authority — domain model and boundary codec contracts.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Special schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SpecialDomainSchema = Schema.Struct({
  domain: Schema.Literal("Special"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical special-functions domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeSpecialDomain = (input: unknown) =>
  Schema.decodeUnknown(SpecialDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Special",
          contract: "SpecialDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical special-functions domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeSpecialDomain = (domain: SpecialDomain) =>
  Schema.encode(SpecialDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Special",
          contract: "SpecialDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Special-functions boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type SpecialSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Special schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type SpecialDomain = typeof SpecialDomainSchema.Type
