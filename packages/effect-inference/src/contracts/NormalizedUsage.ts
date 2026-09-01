/**
 * Normalized token and cost accounting for runtime evidence.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Decodes required input, output, and total token counts while preserving
 * unavailable cache, reasoning, and cost observations as absent.
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
 * Provider-independent token and optional cost observations copied into
 * post-execution evidence. Missing cache, reasoning, or cost fields mean that
 * accounting detail was unavailable, not zero.
 *
 * @since 0.1.0
 * @category type-level
 */
export type NormalizedUsage = Schema.Schema.Type<typeof NormalizedUsageSchema>
