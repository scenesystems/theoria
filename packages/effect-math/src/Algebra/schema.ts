import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Algebra schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const AlgebraDomainSchema = Schema.Struct({
  domain: Schema.Literal("Algebra"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical algebra domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeAlgebraDomain = (input: unknown) =>
  Schema.decodeUnknown(AlgebraDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Algebra",
          contract: "AlgebraDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical algebra domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeAlgebraDomain = (domain: AlgebraDomain) =>
  Schema.encode(AlgebraDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Algebra",
          contract: "AlgebraDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Algebra boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type AlgebraSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Algebra schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type AlgebraDomain = typeof AlgebraDomainSchema.Type
