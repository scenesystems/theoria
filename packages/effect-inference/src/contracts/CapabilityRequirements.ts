/**
 * Capability constraints checked during runtime resolution.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { StructuredOutputModeSchema } from "./RuntimeCapabilities.js"

/**
 * Decodes optional capability constraints. Omitted fields impose no
 * requirement, including `minimumContextTokens`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CapabilityRequirementsSchema = Schema.Struct({
  /** Requires or rejects the language-model lane. */
  textGeneration: Schema.optional(Schema.Boolean),
  /** Requires or rejects the embedding-model lane. */
  embeddings: Schema.optional(Schema.Boolean),
  /** Requires the route's declared streaming value to match. */
  streaming: Schema.optional(Schema.Boolean),
  /** Requires the route's declared tool-calling value to match. */
  toolCalling: Schema.optional(Schema.Boolean),
  /** Lowest acceptable structured-output grade. */
  structuredOutput: Schema.optional(StructuredOutputModeSchema),
  /** Requires the route's declared usage-reporting value to match. */
  usageReporting: Schema.optional(Schema.Boolean),
  /** Requires the route's declared multimodal-input value to match. */
  multimodalInput: Schema.optional(Schema.Boolean),
  /** Inclusive lower bound for the declared context window, in tokens. */
  minimumContextTokens: Schema.optional(Schema.Number)
})

/**
 * Caller constraints checked before model layers are exposed. A present
 * boolean requires that exact declared value.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CapabilityRequirements = Schema.Schema.Type<typeof CapabilityRequirementsSchema>
