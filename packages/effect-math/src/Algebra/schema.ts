/**
 * Validates Algebra discovery metadata and operation inputs at untrusted boundaries.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Accepts only the `"Algebra"` discovery discriminator and a known stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const AlgebraDomainSchema = Schema.Struct({
  domain: Schema.Literal("Algebra"),
  stability: DomainStability
})

/**
 * Admits algebra capability metadata only when its discriminator is
 * `"Algebra"` and its stability lane is known. Excess properties and malformed
 * fields fail with {@link BoundaryDecodeError}.
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
 * Decode failures for unknown input or encode failures for forged Algebra descriptors.
 *
 * @since 0.1.0
 * @category errors
 */
export type AlgebraSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Discovery metadata identifying polynomial, integer, and combinatorial
 * capabilities in a recognized stability lane.
 *
 * @since 0.1.0
 * @category models
 */
export type AlgebraDomain = typeof AlgebraDomainSchema.Type

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Accepts a coefficient array in lowest-degree-first order and a finite
 * evaluation point. Coefficients may contain non-finite numbers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PolyEvalInput = Schema.Struct({
  coefficients: Schema.Array(Schema.Number),
  x: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "PolyEvalInput" })

/**
 * Accepts a coefficient array in lowest-degree-first order. Coefficients may
 * contain non-finite numbers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PolyDerivativeInput = Schema.Struct({
  coefficients: Schema.Array(Schema.Number)
}).annotations({ identifier: "PolyDerivativeInput" })

/**
 * Accepts two integers for greatest-common-divisor calculation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GcdInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.int()),
  b: Schema.Number.pipe(Schema.int())
}).annotations({ identifier: "GcdInput" })

/**
 * Accepts two integers for least-common-multiple calculation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LcmInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.int()),
  b: Schema.Number.pipe(Schema.int())
}).annotations({ identifier: "LcmInput" })

/**
 * Accepts a non-negative integer for factorial calculation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FactorialInput = Schema.Struct({
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}).annotations({ identifier: "FactorialInput" })
