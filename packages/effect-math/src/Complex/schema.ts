/**
 * Complex domain schemas — domain model contract and operation input
 * validation schemas used by boundary-validated operations.
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
 * Schema for the Complex domain model — validates that a value carries
 * the `"Complex"` domain literal and a valid stability level.
 *
 * @see {@link decodeComplexDomain} — decode unknown input through this schema
 * @see {@link encodeComplexDomain} — encode for outbound serialization
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComplexDomainSchema = Schema.Struct({
  domain: Schema.Literal("Complex"),
  stability: DomainStability
})

/**
 * Decoded type of the Complex domain model schema.
 *
 * @since 0.1.0
 * @category models
 */
export type ComplexDomain = typeof ComplexDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical Complex domain
 * model, rejecting excess properties. Maps parse failures to
 * `BoundaryDecodeError` for uniform boundary error handling.
 *
 * @see {@link encodeComplexDomain} — inverse operation
 * @see {@link ComplexDomainSchema} — underlying schema
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeComplexDomain = (input: unknown) =>
  Schema.decodeUnknown(ComplexDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Complex",
          contract: "ComplexDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical Complex domain model for outbound
 * serialization. Maps encode failures to `BoundaryEncodeError`.
 *
 * @see {@link decodeComplexDomain} — inverse operation
 * @see {@link ComplexDomainSchema} — underlying schema
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeComplexDomain = (domain: ComplexDomain) =>
  Schema.encode(ComplexDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Complex",
          contract: "ComplexDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Union of boundary-level encode/decode errors produced by
 * `decodeComplexDomain` and `encodeComplexDomain`.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComplexSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Input schema for unary complex operations. Requires finite real and
 * imaginary parts — rejects `NaN` and `±Infinity` at the boundary.
 *
 * @see {@link ComplexBinaryInput} — two-operand variant
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComplexInput = Schema.Struct({
  re: Schema.Number.pipe(Schema.finite()),
  im: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "ComplexInput" })

/**
 * Input schema for binary complex operations (add, subtract, multiply,
 * divide). Flattens two complex numbers into four finite fields to
 * allow Schema-level validation before kernel dispatch.
 *
 * @see {@link ComplexInput} — single-operand variant
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComplexBinaryInput = Schema.Struct({
  aRe: Schema.Number.pipe(Schema.finite()),
  aIm: Schema.Number.pipe(Schema.finite()),
  bRe: Schema.Number.pipe(Schema.finite()),
  bIm: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "ComplexBinaryInput" })

/**
 * Input schema for complex-step differentiation. Requires a finite
 * evaluation point `x` and an optional positive step size `h`
 * (defaults to 1e-20, optimal for IEEE 754 float64).
 *
 * @see {@link ComplexInput} — standard complex input
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComplexStepInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  h: Schema.optionalWith(
    Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
    { default: () => 1e-20 }
  )
}).annotations({ identifier: "ComplexStepInput" })
