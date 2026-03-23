import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Numeric schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NumericDomainSchema = Schema.Struct({
  domain: Schema.Literal("Numeric"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical numeric domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeNumericDomain = (input: unknown) =>
  Schema.decodeUnknown(NumericDomainSchema)(input).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Numeric",
          contract: "NumericDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical numeric domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeNumericDomain = (domain: NumericDomain) =>
  Schema.encode(NumericDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Numeric",
          contract: "NumericDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Numeric boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type NumericSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Numeric schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type NumericDomain = typeof NumericDomainSchema.Type
