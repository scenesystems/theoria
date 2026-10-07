/**
 * Backend-neutral failures for storage and artifact delivery.
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"

/**
 * A codec, backend, identity, cursor, or recording compatibility failure.
 * Filesystem diagnostics are optional; other backends need not invent paths.
 * @since 0.1.0
 * @category errors
 */
export class Failure extends Schema.TaggedError<Failure>("@scenesystems/effect-study/PersistenceError")(
  "effect-study/PersistenceError",
  {
    reason: Schema.Literals(["Codec", "Backend", "RecordConflict", "CursorConflict", "Incompatible"]),
    operation: Schema.Literals(["read", "write"]),
    detail: Schema.String,
    path: Schema.optional(Schema.String),
    line: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0)))
  }
) {}

/** Maps schema failures while retaining the operation that failed. @since 0.1.0 @category conversions */
export const codec = (operation: Failure["operation"]) => (cause: Schema.SchemaError): Failure =>
  new Failure({ reason: "Codec", operation, detail: cause.message })
