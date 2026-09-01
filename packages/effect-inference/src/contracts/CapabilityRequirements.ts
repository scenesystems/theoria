/**
 * Caller-declared capability requirements for runtime selection.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { StructuredOutputModeSchema } from "./RuntimeCapabilities.js"

/**
 * Optional capability requirements used to constrain route resolution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CapabilityRequirementsSchema = Schema.Struct({
  textGeneration: Schema.optional(Schema.Boolean),
  embeddings: Schema.optional(Schema.Boolean),
  streaming: Schema.optional(Schema.Boolean),
  toolCalling: Schema.optional(Schema.Boolean),
  structuredOutput: Schema.optional(StructuredOutputModeSchema),
  usageReporting: Schema.optional(Schema.Boolean),
  multimodalInput: Schema.optional(Schema.Boolean),
  minimumContextTokens: Schema.optional(Schema.Number)
})

/**
 * Caller constraints checked before model layers are exposed. Omitted fields
 * impose no requirement; a present boolean requires that exact support value,
 * while `minimumContextTokens` sets a lower bound.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CapabilityRequirements = Schema.Schema.Type<typeof CapabilityRequirementsSchema>
