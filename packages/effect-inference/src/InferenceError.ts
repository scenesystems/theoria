/**
 * Schema-backed failures owned by inference configuration and resolution.
 *
 * @since 0.5.0
 * @module
 */
import * as Schema from "effect/Schema"

/** Checked failure for malformed or missing runtime configuration. @since 0.5.0 @category errors */
export class InvalidRuntimeConfig extends Schema.TaggedError<InvalidRuntimeConfig>(
  "@scenesystems/effect-inference/InferenceError/InvalidRuntimeConfig"
)("effect-inference/InvalidRuntimeConfig", { reason: Schema.String }) {}

/** Checked failure for a requirement unsupported by the resolved runtime. @since 0.5.0 @category errors */
export class CapabilityMismatch extends Schema.TaggedError<CapabilityMismatch>(
  "@scenesystems/effect-inference/InferenceError/CapabilityMismatch"
)("effect-inference/CapabilityMismatch", { capability: Schema.String, reason: Schema.String }) {}

/** Checked failure for a route the runtime cannot execute. @since 0.5.0 @category errors */
export class UnsupportedRoute extends Schema.TaggedError<UnsupportedRoute>(
  "@scenesystems/effect-inference/InferenceError/UnsupportedRoute"
)("effect-inference/UnsupportedRoute", {
  family: Schema.optional(Schema.String),
  reason: Schema.String
}) {}

/** Checked failure for an intentionally unavailable runtime feature. @since 0.5.0 @category errors */
export class RuntimeNotImplemented extends Schema.TaggedError<RuntimeNotImplemented>(
  "@scenesystems/effect-inference/InferenceError/RuntimeNotImplemented"
)("effect-inference/RuntimeResolverNotImplemented", { feature: Schema.String }) {}

/**
 * Package-owned inference failure union.
 *
 * @since 0.5.0
 * @category models
 */
export type InferenceError = typeof InferenceError.Type

/**
 * Package-owned inference failure schema.
 *
 * @since 0.5.0
 * @category schemas
 */
export const InferenceError = Schema.Union(
  InvalidRuntimeConfig,
  CapabilityMismatch,
  UnsupportedRoute,
  RuntimeNotImplemented
)
