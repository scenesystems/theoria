/**
 * Normalized token and cost accounting for runtime evidence.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Schema for package-owned usage normalization.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalizedUsageSchema = Schema.Struct({
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  totalTokens: Schema.Number,
  cacheReadTokens: Schema.optional(Schema.Number),
  cacheWriteTokens: Schema.optional(Schema.Number),
  reasoningTokens: Schema.optional(Schema.Number),
  costUsd: Schema.optional(Schema.Number)
})

/**
 * Extracted normalized usage record.
 *
 * @since 0.1.0
 * @category type-level
 */
export type NormalizedUsage = Schema.Schema.Type<typeof NormalizedUsageSchema>
