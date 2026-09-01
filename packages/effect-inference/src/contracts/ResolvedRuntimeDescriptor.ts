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
 * Post-execution observations copied from a provider response. Optional fields
 * distinguish unavailable evidence from inferred defaults; callers should not
 * populate them from pre-execution route resolution.
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
 * Holds observations copied from a completed provider response, on the
 * post-execution side of the provenance boundary. Missing optional fields mean
 * the provider or caller supplied no evidence and must not be defaulted.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResolvedRuntimeDescriptor = Schema.Schema.Type<typeof ResolvedRuntimeDescriptorSchema>
