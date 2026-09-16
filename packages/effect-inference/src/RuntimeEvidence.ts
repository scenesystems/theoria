/**
 * Serializable post-response evidence joined to pre-execution resolution.
 *
 * @since 0.5.0
 * @module
 */
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Schema from "effect/Schema"

import * as Capabilities from "./Capabilities.js"
import { InvalidRuntimeConfig } from "./InferenceError.js"
import * as Route from "./Route.js"
import type { Resolution } from "./Runtime.js"
import * as RuntimeRequest from "./RuntimeRequest.js"

/** Recursive metadata sequence derived from the native array schema.
 * @since 0.5.0
 * @category type-level
 */
export interface MetadataArray extends Schema.Schema.Type<Schema.Array$<Schema.Schema<MetadataValue>>> {}

/** Recursive metadata object derived from the native record schema.
 * @since 0.5.0
 * @category type-level
 */
export interface MetadataRecord extends
  Schema.Schema.Type<
    Schema.Record$<typeof Schema.String, Schema.Schema<MetadataValue>>
  >
{}

type MetadataValueType = Schema.Schema.Type<
  Schema.Union<[
    typeof Schema.String,
    typeof Schema.JsonNumber,
    typeof Schema.Boolean,
    typeof Schema.Null,
    Schema.Schema<MetadataArray>,
    Schema.Schema<MetadataRecord>
  ]>
>

/**
 * Recursive JSON values accepted in persisted provider metadata.
 *
 * @since 0.5.0
 * @category schemas
 */
export const MetadataValue: Schema.Schema<MetadataValueType> = Schema.suspend(() =>
  Schema.Union(
    Schema.String,
    Schema.JsonNumber,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(MetadataValue),
    Schema.Record({ key: Schema.String, value: MetadataValue })
  )
).annotations({ identifier: "@scenesystems/effect-inference/RuntimeEvidence/MetadataValue" })

/**
 * Recursive JSON value inferred from the persistence schema.
 *
 * @since 0.5.0
 * @category models
 */
export type MetadataValue = typeof MetadataValue.Type

/**
 * Provider-keyed JSON extensions retained without normalized semantics.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Metadata = Schema.Record({
  key: Schema.String,
  value: Schema.Record({ key: Schema.String, value: MetadataValue })
}).annotations({ identifier: "@scenesystems/effect-inference/RuntimeEvidence/Metadata" })
/**
 * Provider-keyed JSON metadata inferred from the persistence schema.
 *
 * @since 0.5.0
 * @category models
 */
export type Metadata = typeof Metadata.Type

/**
 * Provider-independent usage copied from a response. Optional accounting
 * fields remain absent when the provider did not report them.
 *
 * @since 0.5.0
 * @category models
 */
export const Usage = Schema.Struct({
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  totalTokens: Schema.Number,
  cacheReadTokens: Schema.optional(Schema.Number),
  cacheWriteTokens: Schema.optional(Schema.Number),
  reasoningTokens: Schema.optional(Schema.Number),
  costUsd: Schema.optional(Schema.Number)
}).annotations({ identifier: "@scenesystems/effect-inference/RuntimeEvidence/Usage" })
/**
 * Provider-independent response usage inferred from its schema.
 *
 * @since 0.5.0
 * @category models
 */
export type Usage = typeof Usage.Type

/**
 * Terminal reasons normalized from provider responses.
 *
 * @since 0.5.0
 * @category schemas
 */
export const FinishReason = Schema.Literal("stop", "length", "tool-call", "content-filter", "error", "other")
  .annotations({ identifier: "@scenesystems/effect-inference/RuntimeEvidence/FinishReason" })
/**
 * Terminal response reason inferred from the canonical schema.
 *
 * @since 0.5.0
 * @category models
 */
export type FinishReason = typeof FinishReason.Type

/**
 * Observations copied from a completed provider response.
 *
 * @since 0.5.0
 * @category models
 */
export const Response = Schema.Struct({
  responseModel: Schema.String,
  responseId: Schema.optional(Schema.String),
  startedAtMs: Schema.optional(Schema.Number),
  completedAtMs: Schema.optional(Schema.Number),
  finishReason: Schema.optional(FinishReason),
  systemFingerprint: Schema.optional(Schema.String),
  usage: Schema.optional(Usage),
  providerMetadata: Schema.optional(Metadata)
}).annotations({ identifier: "@scenesystems/effect-inference/RuntimeEvidence/Response" })
/**
 * Post-execution response observations inferred from their schema.
 *
 * @since 0.5.0
 * @category models
 */
export type Response = typeof Response.Type

/**
 * Envelope keeping request, route decision, capability policy, and response
 * observations in separate channels.
 *
 * @since 0.5.0
 * @category models
 */
export const RuntimeEvidence = Schema.Struct({
  request: RuntimeRequest.RuntimeRequest,
  route: Route.Resolved,
  response: Response,
  capabilities: Capabilities.Capabilities
}).annotations({ identifier: "@scenesystems/effect-inference/RuntimeEvidence/RuntimeEvidence" })
/**
 * Persistable inference evidence inferred from its canonical schema.
 *
 * @since 0.5.0
 * @category models
 */
export type RuntimeEvidence = typeof RuntimeEvidence.Type

/**
 * Combines pre-execution resolution with post-response observations.
 *
 * @since 0.5.0
 * @category constructors
 */
export const make: {
  (response: Response): (resolution: Resolution) => RuntimeEvidence
  (resolution: Resolution, response: Response): RuntimeEvidence
} = dual(2, (resolution: Resolution, response: Response): RuntimeEvidence => ({
  request: resolution.request,
  route: resolution.route,
  response,
  capabilities: resolution.capabilities
}))

/**
 * Decodes persisted evidence. Shape validation does not authenticate provider
 * claims.
 *
 * @since 0.5.0
 * @category decoding
 */
export const decodeUnknown = (input: unknown): Effect.Effect<RuntimeEvidence, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(RuntimeEvidence)(input).pipe(
    Effect.mapError((error) => new InvalidRuntimeConfig({ reason: error.message }))
  )
