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
 * Conservative capability claims emitted by route resolution. These values
 * govern which model layers may be exposed; they are package policy, not
 * observations of a provider deployment or completed request.
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
 * Conservative package-policy result produced during route resolution and
 * used to gate language and embedding layers. It is not a provider attestation
 * or an observation from a completed request.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RuntimeCapabilities = Schema.Schema.Type<typeof RuntimeCapabilitiesSchema>
