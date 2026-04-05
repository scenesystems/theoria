/**
 * Declared capability authority for a runtime family.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Normalized structured-output support grades.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StructuredOutputModeSchema = Schema.Literal("none", "best-effort", "strict")

/**
 * Stable capability record exposed after route resolution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RuntimeCapabilitiesSchema = Schema.Struct({
  textGeneration: Schema.Boolean,
  embeddings: Schema.Boolean,
  streaming: Schema.Boolean,
  toolCalling: Schema.Boolean,
  structuredOutput: StructuredOutputModeSchema,
  usageReporting: Schema.Boolean,
  multimodalInput: Schema.Boolean,
  maxContextTokens: Schema.optional(Schema.Number)
})

/**
 * Extracted resolved capability record.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RuntimeCapabilities = Schema.Schema.Type<typeof RuntimeCapabilitiesSchema>
