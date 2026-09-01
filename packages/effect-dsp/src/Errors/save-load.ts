/**
 * Save and load-domain errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Failure at the module-state persistence boundary. `operation` lets recovery
 * distinguish an unpersisted update from an unavailable saved state; `path`
 * is absent when the failure cannot be attributed to a specific location.
 *
 * @since 0.1.0
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
