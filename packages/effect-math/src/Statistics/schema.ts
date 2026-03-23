import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Statistics schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StatisticsDomainSchema = Schema.Struct({
  domain: Schema.Literal("Statistics"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical statistics domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeStatisticsDomain = (input: unknown) =>
  Schema.decodeUnknown(StatisticsDomainSchema)(input).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Statistics",
          contract: "StatisticsDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical statistics domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeStatisticsDomain = (domain: StatisticsDomain) =>
  Schema.encode(StatisticsDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Statistics",
          contract: "StatisticsDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Statistics boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Statistics schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type StatisticsDomain = typeof StatisticsDomainSchema.Type
