/**
 * Caller-owned inference intent supplied to runtime resolution.
 *
 * @since 0.5.0
 * @module
 */
import { Role } from "@scenesystems/effect-lm/Role"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

import * as Capabilities from "./Capabilities.js"
import { InvalidRuntimeConfig } from "./InferenceError.js"
import * as Model from "./Model.js"
import * as Route from "./Route.js"

/** Schema for the semantic role assigned to an inference request. @since 0.5.0 @category schemas */
export { Role } from "@scenesystems/effect-lm/Role"

/**
 * Model intent, optional route, and capability requirements supplied by a
 * caller. A missing route delegates selection to an outer policy.
 *
 * @since 0.5.0
 * @category models
 */
export const RuntimeRequest = Schema.Struct({
  model: Model.Model,
  route: Schema.optional(Route.Route),
  capabilities: Schema.optional(Capabilities.Requirements),
  role: Schema.optional(Role),
  tags: Schema.optional(Schema.Array(Schema.String))
}).annotate({ identifier: "@scenesystems/effect-inference/RuntimeRequest" })
/** Caller-owned runtime request inferred from its schema. @since 0.5.0 @category models */
export type RuntimeRequest = typeof RuntimeRequest.Type

/**
 * Decodes untrusted caller intent into the package's checked configuration
 * error channel.
 *
 * @since 0.5.0
 * @category decoding
 */
export const decodeUnknown = (input: unknown): Effect.Effect<RuntimeRequest, InvalidRuntimeConfig> =>
  Schema.decodeUnknownEffect(RuntimeRequest)(input).pipe(
    Effect.mapError((error) => new InvalidRuntimeConfig({ reason: error.message }))
  )
