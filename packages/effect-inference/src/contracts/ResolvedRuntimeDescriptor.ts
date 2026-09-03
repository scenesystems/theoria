/**
 * Provider observations recorded after inference completes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { NormalizedUsageSchema } from "./NormalizedUsage.js"
import { ProviderMetadataSchema } from "./ProviderMetadata.js"

/**
 * Accepts normalized reasons for a provider ending generation.
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
  /** Model identifier reported by the provider response. */
  responseModel: Schema.String,
  /** Provider request or response identifier, when reported. */
  responseId: Schema.optional(Schema.String),
  /** Caller-recorded request start time in Unix milliseconds. */
  startedAtMs: Schema.optional(Schema.Number),
  /** Caller-recorded completion time in Unix milliseconds. */
  completedAtMs: Schema.optional(Schema.Number),
  /** Normalized provider finish reason, when available. */
  finishReason: Schema.optional(FinishReasonSchema),
  /** Provider-reported runtime fingerprint, when available. */
  systemFingerprint: Schema.optional(Schema.String),
  /** Normalized token and cost observations. */
  usage: Schema.optional(NormalizedUsageSchema),
  /** JSON-safe details that retain provider-specific meaning. */
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
