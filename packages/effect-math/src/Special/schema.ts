/**
 * Runtime schemas for Special metadata and validated operation inputs.
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
 * Accepts only the `"Special"` discovery discriminator and a known stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SpecialDomainSchema = Schema.Struct({
  domain: Schema.Literal("Special"),
  stability: DomainStability
})

/**
 * Discovery metadata identifying special-function capabilities in a recognized
 * stability lane.
 *
 * @since 0.1.0
 * @category models
 */
export type SpecialDomain = typeof SpecialDomainSchema.Type

/**
 * Decodes a Special-functions discovery descriptor, rejecting unknown fields
 * and mapping parse failures to {@link BoundaryDecodeError}.
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
 * Decode failures for unknown input or encode failures for forged Special descriptors.
 *
 * @since 0.1.0
 * @category errors
 */
export type SpecialSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Accepts one finite gamma argument. Non-positive integer poles are not
 * rejected by this schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "GammaInput" })

/**
 * Accepts one positive finite log-gamma argument.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LnGammaInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "LnGammaInput" })

/**
 * Accepts two positive finite beta arguments.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BetaInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  b: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "BetaInput" })

/**
 * Accepts one finite error-function argument.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ErfInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "ErfInput" })

/**
 * Accepts one positive finite digamma argument.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DigammaInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "DigammaInput" })

/**
 * Accepts a finite inverse-error argument strictly between `-1` and `1`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ErfinvInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(-1), Schema.lessThan(1))
}).annotations({ identifier: "ErfinvInput" })

/**
 * Accepts positive finite `a` and non-negative finite `x` for incomplete gamma.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaincInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
}).annotations({ identifier: "GammaincInput" })

/**
 * Accepts positive finite shape arguments and finite `x` in `[0, 1]` for
 * incomplete beta.
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
 * Accepts a non-negative integer order and positive finite argument for polygamma.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PolygammaInput = Schema.Struct({
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  x: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "PolygammaInput" })
