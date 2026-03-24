/**
 * Algebra schema authority — domain model and boundary codec contracts.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Algebra domain model schema.
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

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Polynomial evaluation input — coefficient array (lowest-degree-first)
 * and a finite evaluation point.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PolyEvalInput = Schema.Struct({
  coefficients: Schema.Array(Schema.Number),
  x: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "PolyEvalInput" })

/**
 * Polynomial derivative input — coefficient array (lowest-degree-first).
 *
 * @since 0.1.0
 * @category schemas
 */
export const PolyDerivativeInput = Schema.Struct({
  coefficients: Schema.Array(Schema.Number)
}).annotations({ identifier: "PolyDerivativeInput" })

/**
 * GCD input — two integers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GcdInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.int()),
  b: Schema.Number.pipe(Schema.int())
}).annotations({ identifier: "GcdInput" })

/**
 * LCM input — two integers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LcmInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.int()),
  b: Schema.Number.pipe(Schema.int())
}).annotations({ identifier: "LcmInput" })

/**
 * Factorial input — non-negative integer.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FactorialInput = Schema.Struct({
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}).annotations({ identifier: "FactorialInput" })
