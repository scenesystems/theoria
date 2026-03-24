/**
 * Save and load-domain errors.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Raised when module parameter persistence fails. The `operation` field
 * discriminates between save and load failures.
 *
 * @since 0.0.0
 * @category errors
 */
export class SaveLoadError extends Schema.TaggedError<SaveLoadError>()(
  "SaveLoadError",
  {
    message: Schema.String,
    operation: Schema.Literal("save", "load"),
    path: Schema.optional(Schema.String)
  }
) {}
