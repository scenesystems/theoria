import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Optimization schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizationDomainSchema = Schema.Struct({
  domain: Schema.Literal("Optimization"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical optimization domain model.
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
 * Optimization boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Optimization schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type OptimizationDomain = typeof OptimizationDomainSchema.Type
