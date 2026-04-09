/**
 * Post-execution runtime evidence authority.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { NormalizedUsageSchema } from "./NormalizedUsage.js"
import { ProviderMetadataSchema } from "./ProviderMetadata.js"

/**
 * Normalized finish reasons surfaced across providers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FinishReasonSchema = Schema.Literal(
  "stop",
  "length",
  "tool-call",
  "content-filter",
  "error",
  "other"
)

/**
 * Schema describing runtime truth discovered after execution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolvedRuntimeDescriptorSchema = Schema.Struct({
  responseModel: Schema.String,
  responseId: Schema.optional(Schema.String),
  startedAtMs: Schema.optional(Schema.Number),
  completedAtMs: Schema.optional(Schema.Number),
  finishReason: Schema.optional(FinishReasonSchema),
  systemFingerprint: Schema.optional(Schema.String),
  usage: Schema.optional(NormalizedUsageSchema),
  providerMetadata: Schema.optional(ProviderMetadataSchema)
})

/**
 * Canonical resolved-runtime descriptor constructor surface.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ResolvedRuntimeDescriptor = ResolvedRuntimeDescriptorSchema

/**
 * Extracted resolved-runtime descriptor type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResolvedRuntimeDescriptor = Schema.Schema.Type<typeof ResolvedRuntimeDescriptor>
