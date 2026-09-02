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
    /** Rejected route family, when one was supplied. */
    family: Schema.optional(Schema.String),
    /** Missing or unsupported route condition. */
    reason: Schema.String
  }
) {}

/**
 * Reports an operation omitted by a custom {@link RuntimeResolverApi}
 * implementation.
 *
 * @since 0.1.0
 * @category errors
 */
export class RuntimeResolverNotImplemented extends Schema.TaggedError<RuntimeResolverNotImplemented>()(
  "effect-inference/RuntimeResolverNotImplemented",
  {
    /** Resolver operation unavailable from the selected implementation. */
    feature: Schema.String
  }
) {}
