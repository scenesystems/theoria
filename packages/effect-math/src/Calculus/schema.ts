/**
 * Calculus schema authority — domain model and operation input
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
 * Calculus domain model schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalculusDomainSchema = Schema.Struct({
  domain: Schema.Literal("Calculus"),
  stability: DomainStability
})

/**
 * Calculus schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type CalculusDomain = typeof CalculusDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical calculus domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeCalculusDomain = (input: unknown) =>
  Schema.decodeUnknown(CalculusDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Calculus",
          contract: "CalculusDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical calculus domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeCalculusDomain = (domain: CalculusDomain) =>
  Schema.encode(CalculusDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Calculus",
          contract: "CalculusDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Calculus boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type CalculusSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Derivative input — finite x coordinate and optional positive step
 * size h.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DerivativeInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  h: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)))
}).annotations({ identifier: "DerivativeInput" })

/**
 * Trapezoidal rule input — array of sample values and positive step
 * size dx.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrapezoidInput = Schema.Struct({
  values: Schema.Array(Schema.Number),
  dx: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "TrapezoidInput" })

/**
 * Simpson's rule input — array of sample values and positive step
 * size dx.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SimpsonInput = Schema.Struct({
  values: Schema.Array(Schema.Number),
  dx: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "SimpsonInput" })
