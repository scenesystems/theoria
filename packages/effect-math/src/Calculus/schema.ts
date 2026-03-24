/**
 * Calculus schema authority — domain model and boundary codec contracts.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Calculus schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalculusDomainSchema = Schema.Struct({
  domain: Schema.Literal("Calculus"),
  stability: DomainStability
})

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

/**
 * Calculus schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type CalculusDomain = typeof CalculusDomainSchema.Type
