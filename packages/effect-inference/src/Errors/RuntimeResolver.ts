/**
 * Typed failures produced by runtime resolution.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Raised when no route family or route shape can satisfy a requested runtime
 * descriptor.
 *
 * @since 0.1.0
 * @category errors
 */
export class UnsupportedRoute extends Schema.TaggedError<UnsupportedRoute>()(
  "effect-inference/UnsupportedRoute",
  {
    family: Schema.optional(Schema.String),
    reason: Schema.String
  }
) {}

/**
 * Placeholder failure used by the initial live skeleton until real adapter
 * layers are wired.
 *
 * @since 0.1.0
 * @category errors
 */
export class RuntimeResolverNotImplemented extends Schema.TaggedError<RuntimeResolverNotImplemented>()(
  "effect-inference/RuntimeResolverNotImplemented",
  {
    feature: Schema.String
  }
) {}
