/**
 * Validates Complex discovery metadata and operation inputs at untrusted boundaries.
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
 * Accepts the `"Complex"` discovery discriminator and a known stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComplexDomainSchema = Schema.Struct({
  domain: Schema.Literal("Complex"),
  stability: DomainStability
})

/**
 * A validated `"Complex"` discovery descriptor and its declared stability.
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
 * Accepts finite real and imaginary components for a unary operation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComplexInput = Schema.Struct({
  re: Schema.Number.pipe(Schema.finite()),
  im: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "ComplexInput" })

/**
 * Accepts finite components for two complex operands. The flat representation
 * keeps input independent of the `Complex` class.
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
 * Accepts complex-step differentiation input with a finite
 * evaluation point `x` and an optional positive step size `h`
 * that defaults to `1e-20`.
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
