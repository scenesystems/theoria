import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option } from "effect"

import { SourceFilePath } from "./model.js"

/**
 * Normalizes a platform path to forward slashes for stable structural assertions.
 *
 * @since 0.0.0
 * @category path
 */
export const toForwardSlashes = (pathService: Path.Path, value: string): string =>
  value.split(pathService.sep).join("/")

/**
 * Splits a path-like string into non-empty segments.
 *
 * @since 0.0.0
 * @category path
 */
export const pathSegments = (value: string): ReadonlyArray<string> =>
  value.split("/").filter((segment) => segment.length > 0)

/**
 * Checks whether a specifier contains the expected path-segment sequence.
 *
 * @since 0.0.0
 * @category path
 */
export const containsPathSegmentSequence = (specifier: string, expected: ReadonlyArray<string>): boolean => {
  const segments = pathSegments(specifier)
  return Option.match(Option.fromNullable(expected[0]), {
    onNone: () => false,
    onSome: (firstSegment) => {
      const startIndex = segments.indexOf(firstSegment)

      if (startIndex < 0) {
        return false
      }

      return expected.every((segment, index) => segments[index + startIndex] === segment)
    }
  })
}

/**
 * Detects imports that cross a package-private `internal/` boundary.
 *
 * @since 0.0.0
 * @category path
 */
export const referencesInternalBoundary = (specifier: string): boolean =>
  containsPathSegmentSequence(specifier, ["internal"])

const viteFsPathFromUrl = (rootUrl: URL): Option.Option<string> => {
  if (!rootUrl.pathname.startsWith("/@fs/")) {
    return Option.none()
  }

  return Option.some(decodeURIComponent(rootUrl.pathname.replace(/^\/@fs/, "")))
}

/**
 * Resolves a project root URL from either a `file:` URL or a Vite `@fs` URL.
 *
 * @since 0.0.0
 * @category path
 */
export const resolveRootFrom = (rootUrl: URL): Effect.Effect<string, never, Path.Path> =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path

    if (rootUrl.protocol === "file:") {
      return yield* pathService.fromFileUrl(rootUrl).pipe(Effect.orDie)
    }

    return yield* Option.match(viteFsPathFromUrl(rootUrl), {
      onNone: () => Effect.dieMessage(`Unsupported project root URL: ${rootUrl.toString()}`),
      onSome: Effect.succeed
    })
  })

/**
 * Builds a `SourceFilePath` from a recursive directory entry.
 *
 * @since 0.0.0
 * @category path
 */
export const toSourceFilePath = (
  pathService: Path.Path,
  root: string,
  absoluteSourceRoot: string,
  entry: string
): SourceFilePath => {
  const absolutePath = pathService.join(absoluteSourceRoot, entry)

  return new SourceFilePath({
    absolute: absolutePath,
    relative: toForwardSlashes(pathService, pathService.relative(root, absolutePath))
  })
}

/**
 * Recursively lists TypeScript files beneath a project-relative directory.
 *
 * @since 0.0.0
 * @category project
 */
export const listTypeScriptFilesInDir = (
  rootUrl: URL,
  dirRelative: string
): Effect.Effect<Array<SourceFilePath>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const root = yield* resolveRootFrom(rootUrl)
    const absoluteDir = pathService.join(root, dirRelative)
    const exists = yield* fileSystem.exists(absoluteDir).pipe(Effect.orDie)

    if (!exists) {
      return []
    }

    const entries = yield* fileSystem.readDirectory(absoluteDir, { recursive: true }).pipe(Effect.orDie)

    return Arr.flatMap(entries, (entry) =>
      entry.endsWith(".ts")
        ? [toSourceFilePath(pathService, root, absoluteDir, entry)]
        : [])
  })

/**
 * Reads a project-relative file if it exists, or returns an empty string if it does not.
 *
 * @since 0.0.0
 * @category project
 */
export const readProjectFile = (
  rootUrl: URL,
  relativePath: string
): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const root = yield* resolveRootFrom(rootUrl)
    const absolutePath = pathService.join(root, relativePath)
    const exists = yield* fileSystem.exists(absolutePath).pipe(Effect.orDie)

    if (!exists) {
      return ""
    }

    return yield* fileSystem.readFileString(absolutePath).pipe(Effect.orDie)
  })
