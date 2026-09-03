/**
 * Defines discovery metadata and serializable settings for scalar optimization.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Accepts only the `"Optimization"` discovery discriminator and a known stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizationDomainSchema = Schema.Struct({
  domain: Schema.Literal("Optimization"),
  stability: DomainStability
})

/**
 * Decodes Optimization discovery metadata and rejects excess fields.
 *
 * @throws {@link BoundaryDecodeError} in the Effect error channel when the
 * discriminator, stability, or object shape is invalid.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeOptimizationDomain = (input: unknown) =>
  Schema.decodeUnknown(OptimizationDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Optimization",
          contract: "OptimizationDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes validated Optimization discovery metadata.
 *
 * @throws {@link BoundaryEncodeError} in the Effect error channel when a
 * value has been forged outside the `OptimizationDomain` type.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeOptimizationDomain = (domain: OptimizationDomain) =>
  Schema.encode(OptimizationDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Optimization",
          contract: "OptimizationDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Identifies Optimization descriptor decode and encode failures.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Decoded Optimization discovery descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type OptimizationDomain = typeof OptimizationDomainSchema.Type

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Accepts finite bisection endpoints and optional positive stopping settings.
 *
 * @remarks
 * `maxIterations` must be an integer. Endpoint ordering and sign change are
 * mathematical preconditions outside this schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BisectInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite()),
  b: Schema.Number.pipe(Schema.finite()),
  tolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  maxIterations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}).annotations({ identifier: "BisectInput" })

/**
 * Accepts finite golden-section endpoints and optional positive stopping settings.
 *
 * @remarks
 * `maxIterations` must be an integer. Endpoint ordering and objective
 * unimodality are mathematical preconditions outside this schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GoldenSectionInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite()),
  b: Schema.Number.pipe(Schema.finite()),
  tolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  maxIterations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}).annotations({ identifier: "GoldenSectionInput" })
