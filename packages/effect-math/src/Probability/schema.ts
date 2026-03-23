import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Probability schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProbabilityDomainSchema = Schema.Struct({
  domain: Schema.Literal("Probability"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical probability domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeProbabilityDomain = (input: unknown) =>
  Schema.decodeUnknown(ProbabilityDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Probability",
          contract: "ProbabilityDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical probability domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeProbabilityDomain = (domain: ProbabilityDomain) =>
  Schema.encode(ProbabilityDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Probability",
          contract: "ProbabilityDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Probability boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type ProbabilitySchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Probability schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type ProbabilityDomain = typeof ProbabilityDomainSchema.Type
