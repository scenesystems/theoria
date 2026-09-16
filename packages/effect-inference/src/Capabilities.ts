/**
 * Conservative route capabilities and caller requirements.
 *
 * @since 0.5.0
 * @module
 */
import * as Schema from "effect/Schema"

/** Ordered support levels for structured model output. @since 0.5.0 @category schemas */
export const StructuredOutput = Schema.Literal("none", "best-effort", "strict")
  .annotations({ identifier: "@scenesystems/effect-inference/Capabilities/StructuredOutput" })
/** Structured-output support level inferred from its schema. @since 0.5.0 @category models */
export type StructuredOutput = typeof StructuredOutput.Type

/**
 * Conservative capability policy for a resolved route.
 *
 * @since 0.5.0
 * @category models
 */
export const Capabilities = Schema.Struct({
  textGeneration: Schema.Boolean,
  embeddings: Schema.Boolean,
  streaming: Schema.Boolean,
  toolCalling: Schema.Boolean,
  structuredOutput: StructuredOutput,
  usageReporting: Schema.Boolean,
  multimodalInput: Schema.Boolean,
  maxContextTokens: Schema.optional(Schema.Number)
}).annotations({ identifier: "@scenesystems/effect-inference/Capabilities/Capabilities" })
/** Resolved runtime capabilities inferred from their schema. @since 0.5.0 @category models */
export type Capabilities = typeof Capabilities.Type

/**
 * Caller requirements checked during resolution. False and omitted booleans do
 * not impose requirements.
 *
 * @since 0.5.0
 * @category models
 */
export const Requirements = Schema.Struct({
  textGeneration: Schema.optional(Schema.Boolean),
  embeddings: Schema.optional(Schema.Boolean),
  streaming: Schema.optional(Schema.Boolean),
  toolCalling: Schema.optional(Schema.Boolean),
  structuredOutput: Schema.optional(StructuredOutput),
  usageReporting: Schema.optional(Schema.Boolean),
  multimodalInput: Schema.optional(Schema.Boolean),
  minimumContextTokens: Schema.optional(Schema.Number)
}).annotations({ identifier: "@scenesystems/effect-inference/Capabilities/Requirements" })
/** Caller capability requirements inferred from their schema. @since 0.5.0 @category models */
export type Requirements = typeof Requirements.Type
