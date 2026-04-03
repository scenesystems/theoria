import { Data } from "effect"

/**
 * Absolute and project-relative path metadata for a discovered source file.
 *
 * @since 0.0.0
 * @category models
 */
export class SourceFilePath extends Data.Class<{
  readonly absolute: string
  readonly relative: string
}> {}
