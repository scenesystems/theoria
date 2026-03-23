import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * LinearAlgebra schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearAlgebraDomainSchema = Schema.Struct({
  domain: Schema.Literal("LinearAlgebra"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical linear-algebra domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeLinearAlgebraDomain = (input: unknown) =>
  Schema.decodeUnknown(LinearAlgebraDomainSchema)(input).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "LinearAlgebra",
          contract: "LinearAlgebraDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical linear-algebra domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeLinearAlgebraDomain = (domain: LinearAlgebraDomain) =>
  Schema.encode(LinearAlgebraDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "LinearAlgebra",
          contract: "LinearAlgebraDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Linear-algebra boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type LinearAlgebraSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * LinearAlgebra schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type LinearAlgebraDomain = typeof LinearAlgebraDomainSchema.Type
