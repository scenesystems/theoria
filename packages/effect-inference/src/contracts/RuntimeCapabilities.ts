/**
 * Conservative capability policy attached to a resolved route.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Orders structured-output support from unavailable through strict schema
 * enforcement.
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
  /** Whether resolution exposes a language-model layer. */
  textGeneration: Schema.Boolean,
  /** Whether resolution exposes an embedding-model layer. */
  embeddings: Schema.Boolean,
  /** Whether the selected adapter declares streaming support. */
  streaming: Schema.Boolean,
  /** Whether the selected adapter declares tool-call support. */
  toolCalling: Schema.Boolean,
  /** Declared structured-output enforcement grade. */
  structuredOutput: StructuredOutputModeSchema,
  /** Whether the selected adapter declares normalized usage reporting. */
  usageReporting: Schema.Boolean,
  /** Whether the selected adapter declares multimodal request input. */
  multimodalInput: Schema.Boolean,
  /** Declared context-window limit in tokens, when policy establishes one. */
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
