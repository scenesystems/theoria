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
  /** Requires the language-model lane when true; false adds no constraint. */
  textGeneration: Schema.optional(Schema.Boolean),
  /** Requires the embedding-model lane when true; false adds no constraint. */
  embeddings: Schema.optional(Schema.Boolean),
  /** Requires declared streaming support when true; false adds no constraint. */
  streaming: Schema.optional(Schema.Boolean),
  /** Requires declared tool-calling support when true; false adds no constraint. */
  toolCalling: Schema.optional(Schema.Boolean),
  /** Lowest acceptable structured-output grade. */
  structuredOutput: Schema.optional(StructuredOutputModeSchema),
  /** Requires declared usage-reporting support when true; false adds no constraint. */
  usageReporting: Schema.optional(Schema.Boolean),
  /** Requires declared multimodal-input support when true; false adds no constraint. */
  multimodalInput: Schema.optional(Schema.Boolean),
  /** Inclusive lower bound for the declared context window, in tokens. */
  minimumContextTokens: Schema.optional(Schema.Number)
})

/**
 * Caller constraints checked before model layers are exposed. A present
 * true boolean requires support; false or omission imposes no requirement.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CapabilityRequirements = Schema.Schema.Type<typeof CapabilityRequirementsSchema>
