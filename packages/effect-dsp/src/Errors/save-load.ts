/**
 * Module parameter persistence failures.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Reports a failed module-state serialization or restoration operation.
 *
 * @remarks
 * {@link load} uses this error for invalid envelopes and mismatched module-name
 * sets. {@link save} only snapshots in-memory refs and has no typed failure;
 * integrations may use the `"save"` variant for external persistence failures.
 *
 * @since 0.1.0
 * @category errors
 */
export class SaveLoadError extends Schema.TaggedError<SaveLoadError>()(
  "SaveLoadError",
  {
    /** Diagnostic text from validation or the persistence integration. */
    message: Schema.String,
    /** Operation that did not complete. */
    operation: Schema.Literal("save", "load"),
    /** Storage location involved in the failure, when one is known. */
    path: Schema.optional(Schema.String)
  }
) {}
