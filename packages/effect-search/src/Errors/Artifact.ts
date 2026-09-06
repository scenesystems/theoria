/**
 * Expected failures owned by artifact envelope storage.
 *
 * @since 0.4.4
 */
import { Schema } from "effect"

import { SearchErrorTypeId } from "./typeId.js"

/**
 * Reports that an artifact sink could not persist an envelope or that an artifact
 * log could not be read. `operation` names the side that failed, `path` the log or
 * directory involved, and `detail` the platform or encoding diagnostic. A missing log
 * is not an error: readers return an empty stream for it.
 *
 * @since 0.4.4
 * @category errors
 */
export class ArtifactStorageError extends Schema.TaggedError<ArtifactStorageError>()(
  "effect-search/ArtifactStorageError",
  {
    /** Whether the envelope log was being written or read. */
    operation: Schema.Literal("write", "read"),
    /** Directory or file the operation addressed. */
    path: Schema.String,
    /** Diagnostic from the filesystem or the envelope codec. */
    detail: Schema.String
  }
) {
  /** @since 0.4.4 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}
