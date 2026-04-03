/**
 * Structural governance tests for @scenesystems/digest.
 *
 * Enforces three invariants:
 * 1. File size discipline — src files stay under 240 LOC
 * 2. Internal boundary — only approved src files import from internal/
 * 3. Export governance — package.json exports match expected surface
 */

import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, HashMap, Number as Num, Option, Order, Record, Schema } from "effect"

import {
  moduleSpecifiers,
  parseTypeScript,
  referencesInternalBoundary,
  resolveRootFrom,
  toSourceFilePath
} from "../../../../tools/testing/sourceProof.js"

const MAX_SOURCE_FILE_LINES = 240

const OVERSIZE_SOURCE_FILE_NOTES: ReadonlyArray<readonly [string, string]> = []

const OVERSIZE_SOURCE_FILE_NOTES_MAP = HashMap.fromIterable(OVERSIZE_SOURCE_FILE_NOTES)

const INTERNAL_IMPORT_ALLOWED_PREFIXES = [
  "src/canonicalize.ts",
  "src/convenience.ts",
  "src/digest.ts"
]

const ManifestExportKeysSchema = Schema.parseJson(
  Schema.Struct({
    exports: Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    })
  })
)

const EXPECTED_EXPORT_KEYS = [
  "."
]

class SourceFilePath extends Data.Class<{
  readonly absolute: string
  readonly relative: string
}> {}

const packageRootUrl = new URL("../../", import.meta.url)

const listTypeScriptFiles: Effect.Effect<Array<SourceFilePath>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveRootFrom(packageRootUrl)
    const absoluteSourceRoot = path.join(root, "src")
    const entries = yield* fileSystem.readDirectory(absoluteSourceRoot, { recursive: true }).pipe(Effect.orDie)

    return Arr.flatMap(entries, (entry) =>
      entry.endsWith(".ts")
        ? [toSourceFilePath(path, root, absoluteSourceRoot, entry)]
        : [])
  }
)

class OversizeSourceFinding extends Data.Class<{
  readonly path: string
  readonly lines: number
}> {}

const oversizeSourceFindings: Effect.Effect<Array<OversizeSourceFinding>, never, FileSystem.FileSystem | Path.Path> =
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) => content.split("\n").length),
        Effect.map((lines) =>
          Num.greaterThan(lines, MAX_SOURCE_FILE_LINES)
            ? Option.some<OversizeSourceFinding>(new OversizeSourceFinding({ path: file.relative, lines }))
            : Option.none<OversizeSourceFinding>()
        )
      ))

    return Arr.filterMap(findings, (finding) => finding)
  })

const hasAllowedInternalImport = (relativePath: string): boolean =>
  INTERNAL_IMPORT_ALLOWED_PREFIXES.some((allowed) => relativePath === allowed)

const internalBoundaryViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          moduleSpecifiers(parseTypeScript(file.relative, content)).some((specifier) =>
            referencesInternalBoundary(specifier)
          )
          && !hasAllowedInternalImport(file.relative)
        ),
        Effect.map((isViolation) =>
          isViolation
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (finding) => finding)
  }
)

const packageExportKeys: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveRootFrom(packageRootUrl)
    const packageJsonPath = path.join(root, "package.json")
    const packageJson = yield* fileSystem.readFileString(packageJsonPath).pipe(Effect.orDie)
    const decoded = yield* Schema.decodeUnknown(ManifestExportKeysSchema)(packageJson).pipe(Effect.orDie)

    return Arr.sort(Record.keys(decoded.exports), Order.string)
  }
)

describe("governance", () => {
  it.effect("documents every src file over 240 LOC", () =>
    Effect.gen(function*() {
      const oversized = yield* oversizeSourceFindings
      const oversizedPaths = Arr.sort(Arr.map(oversized, (entry) => entry.path), Order.string)
      const documentedPaths = Arr.sort(Arr.map(OVERSIZE_SOURCE_FILE_NOTES, ([path]) => path), Order.string)

      expect(oversizedPaths).toEqual(documentedPaths)

      const undocumented = Arr.filter(oversized, (entry) => !HashMap.has(OVERSIZE_SOURCE_FILE_NOTES_MAP, entry.path))
      expect(undocumented).toEqual([])

      const emptyNotes = Arr.filter(OVERSIZE_SOURCE_FILE_NOTES, ([, note]) => note.trim().length <= 0)
      expect(emptyNotes).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps internal imports behind approved file boundaries", () =>
    Effect.gen(function*() {
      expect(yield* internalBoundaryViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("preserves export governance contracts", () =>
    Effect.gen(function*() {
      const exportKeys = yield* packageExportKeys
      expect(exportKeys).toEqual(Arr.sort(EXPECTED_EXPORT_KEYS, Order.string))
    }).pipe(Effect.provide(BunContext.layer)))
})
