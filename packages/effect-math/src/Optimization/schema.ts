/**
 * Optimization schema authority — domain model and boundary codec contracts.
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
 * Validates optimizer discovery metadata before root-finding or minimization
 * registration. Unknown stability values, wrong discriminators, and excess
 * properties fail with {@link BoundaryDecodeError}.
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
 * Encodes the canonical optimization domain model at the package boundary.
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
 * Decode failures for unknown input or encode failures for forged Optimization descriptors.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Discovery metadata identifying root-finding and minimization capabilities in
 * a recognized stability lane.
 *
 * @since 0.1.0
 * @category models
 */
export type OptimizationDomain = typeof OptimizationDomainSchema.Type

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Options for validated bisection. Endpoints must be finite; when present,
 * `tolerance` must be positive and finite and `maxIterations` must be a
 * positive integer. The schema does not require `a < b` or prove that the
 * endpoint function values have opposite signs.
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
 * Options for validated golden-section search. Endpoints must be finite; when
 * present, `tolerance` must be positive and finite and `maxIterations` must be
 * a positive integer. The schema does not require `a < b` and cannot establish
 * that an objective is unimodal on the interval.
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
