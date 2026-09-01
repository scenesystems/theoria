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
 * Reports a resolver feature for which no implementation was supplied. The
 * stable live resolver does not currently emit this error, but custom
 * {@link RuntimeResolverApi} implementations may use it.
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
