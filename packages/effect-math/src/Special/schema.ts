/**
 * Special-functions schema authority — domain model and operation input
 * contracts.
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
 * Special-functions domain model schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SpecialDomainSchema = Schema.Struct({
  domain: Schema.Literal("Special"),
  stability: DomainStability
})

/**
 * Special schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type SpecialDomain = typeof SpecialDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical special-functions
 * domain model.
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
 * Encodes the canonical special-functions domain model at the package
 * boundary.
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

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Gamma function input — any finite number (reflection formula handles
 * x < 0.5; poles at non-positive integers produce Infinity).
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "GammaInput" })

/**
 * Log-gamma input — strictly positive finite scalar (lnΓ is undefined
 * for x ≤ 0).
 *
 * @since 0.1.0
 * @category schemas
 */
export const LnGammaInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "LnGammaInput" })

/**
 * Beta function input — two strictly positive finite scalars.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BetaInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  b: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "BetaInput" })

/**
 * Error function input — any finite scalar.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ErfInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "ErfInput" })

/**
 * Digamma input — strictly positive finite scalar (ψ is undefined for
 * x ≤ 0 in this implementation).
 *
 * @since 0.1.0
 * @category schemas
 */
export const DigammaInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "DigammaInput" })

/**
 * Inverse error function input — finite scalar in (-1, 1).
 *
 * @since 0.1.0
 * @category schemas
 */
export const ErfinvInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(-1), Schema.lessThan(1))
}).annotations({ identifier: "ErfinvInput" })

/**
 * Regularised incomplete gamma function input — a > 0, x ≥ 0.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaincInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
}).annotations({ identifier: "GammaincInput" })

/**
 * Regularised incomplete beta function input — a > 0, b > 0, x ∈ [0, 1].
 *
 * @since 0.1.0
 * @category schemas
 */
export const BetaincInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  b: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1))
}).annotations({ identifier: "BetaincInput" })

/**
 * Polygamma function input — non-negative integer n and x > 0.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PolygammaInput = Schema.Struct({
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "PolygammaInput" })
