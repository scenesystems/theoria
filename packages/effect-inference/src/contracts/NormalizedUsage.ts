/**
 * Provider-independent usage observations recorded after inference.
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
  /** Tokens attributed to request input. */
  inputTokens: Schema.Number,
  /** Tokens attributed to generated output. */
  outputTokens: Schema.Number,
  /** Provider-reported aggregate token count. */
  totalTokens: Schema.Number,
  /** Input tokens served from a provider cache, when reported. */
  cacheReadTokens: Schema.optional(Schema.Number),
  /** Input tokens written to a provider cache, when reported. */
  cacheWriteTokens: Schema.optional(Schema.Number),
  /** Tokens attributed to provider-specific reasoning, when reported. */
  reasoningTokens: Schema.optional(Schema.Number),
  /** Provider-reported request cost in US dollars, when available. */
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
