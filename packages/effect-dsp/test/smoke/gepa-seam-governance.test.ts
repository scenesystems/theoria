/**
 * Governance: GEPA seam ownership and boundary proofs.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"

import { moduleSpecifiers, parseTypeScript, pathSegments, referencesInternalBoundary } from "@theoria/source-proof"

const MAX_SOURCE_FILE_LINES = 240

const PackageExportsSchema = Schema.parseJson(
  Schema.Struct({
    exports: Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    })
  })
)

type PackageExports = Schema.Schema.Type<typeof PackageExportsSchema>["exports"]

const packageRootUrl = new URL("../../", import.meta.url)

const resolveProjectRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path

  return yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
})

const toForwardSlashes = (path: Path.Path, value: string): string => value.split(path.sep).join("/")

const toRelativePath = (
  path: Path.Path,
  root: string,
  absolutePath: string
): string => toForwardSlashes(path, path.relative(root, absolutePath))

const listTypeScriptFiles = (
  dirRelative: string
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveProjectRoot
    const absoluteDir = path.join(root, dirRelative)
    const exists = yield* fileSystem.exists(absoluteDir).pipe(Effect.orDie)

    if (!exists) return []

    const entries = yield* fileSystem.readDirectory(absoluteDir, { recursive: true }).pipe(Effect.orDie)

    return Arr.flatMap(entries, (entry) =>
      entry.endsWith(".ts")
        ? [path.join(absoluteDir, entry)]
        : [])
  })

const readProjectFile = (
  relativePath: string
): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveProjectRoot
    const absolutePath = path.join(root, relativePath)
    const exists = yield* fileSystem.exists(absolutePath).pipe(Effect.orDie)

    if (!exists) return ""

    return yield* fileSystem.readFileString(absolutePath).pipe(Effect.orDie)
  })

const allowedEffectSearchSpecifiers = Arr.make("Pareto", "Sampler", "Study")

describe("GEPA seam governance", () => {
  it.effect("consumes only public effect-search seams and never internal effect-search modules", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveProjectRoot
      const files = yield* listTypeScriptFiles("src/optimizers/GEPA")

      const sourcePairs = yield* Effect.forEach(files, (absolutePath) =>
        fileSystem.readFileString(absolutePath).pipe(
          Effect.orDie,
          Effect.map((source): readonly [string, string] => [absolutePath, source])
        ))

      const internalSeamViolations = Arr.filterMap(
        sourcePairs,
        ([absolutePath, source]) =>
          moduleSpecifiers(parseTypeScript(absolutePath, source)).some((specifier) => {
              const segments = pathSegments(specifier)
              return segments[0] === "effect-search" && segments[1] === "internal"
            })
            ? Option.some(toRelativePath(path, root, absolutePath))
            : Option.none<string>()
      )

      const imports = Arr.flatMap(
        sourcePairs,
        ([absolutePath, source]) =>
          moduleSpecifiers(parseTypeScript(absolutePath, source)).flatMap((specifier) => {
            const segments = pathSegments(specifier)
            return segments[0] === "effect-search" && segments.length > 1
              ? [segments[1]]
              : []
          })
      )
      const unexpectedImports = Arr.filter(
        imports,
        (specifier) => !Arr.contains(allowedEffectSearchSpecifiers, specifier)
      )

      expect(internalSeamViolations).toEqual([])
      expect(unexpectedImports).toEqual([])
      expect(imports).toContain("Pareto")
      expect(imports).toContain("Sampler")
      expect(imports).toContain("Study")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps GEPA modules free of forbidden project-internal imports", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveProjectRoot
      const files = yield* listTypeScriptFiles("src/optimizers/GEPA")

      const violations = yield* Effect.forEach(files, (absolutePath) =>
        fileSystem.readFileString(absolutePath).pipe(
          Effect.orDie,
          Effect.map((source) =>
            moduleSpecifiers(parseTypeScript(absolutePath, source)).some((specifier) =>
                referencesInternalBoundary(specifier)
              )
              ? Option.some(toRelativePath(path, root, absolutePath))
              : Option.none<string>()
          )
        )).pipe(Effect.map(Arr.filterMap((f) => f)))

      expect(violations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("includes GEPA in file-size and export-map governance checks", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveProjectRoot
      const packageSource = yield* readProjectFile("package.json")
      const packageExports = yield* Schema.decodeUnknown(PackageExportsSchema)(packageSource).pipe(
        Effect.map((decoded): PackageExports => decoded.exports)
      )
      const optimizerIndexSource = parseTypeScript(
        "src/Optimizer/index.ts",
        yield* readProjectFile("src/Optimizer/index.ts")
      )
      const optimizerEventsIndexSource = parseTypeScript(
        "src/Optimizer/events/index.ts",
        yield* readProjectFile("src/Optimizer/events/index.ts")
      )
      const gepaFiles = yield* listTypeScriptFiles("src/optimizers/GEPA")
      const oversizedGepaFiles = yield* Effect.forEach(gepaFiles, (absolutePath) =>
        fileSystem.readFileString(absolutePath).pipe(
          Effect.orDie,
          Effect.map((content) => {
            const lineCount = content.split("\n").length

            return lineCount > MAX_SOURCE_FILE_LINES
              ? Option.some(`${toRelativePath(path, root, absolutePath)} (${lineCount})`)
              : Option.none<string>()
          })
        )).pipe(Effect.map(Arr.filterMap((f) =>
          f
        )))

      expect(packageExports["./internal/*"]).toBeNull()
      expect(packageExports["./optimizers/*"]).toBeNull()
      expect(moduleSpecifiers(optimizerIndexSource)).toContain("./gepa.js")
      expect(moduleSpecifiers(optimizerIndexSource)).toContain("./gepaStream.js")
      expect(moduleSpecifiers(optimizerEventsIndexSource)).toContain("./gepa.js")
      expect(oversizedGepaFiles).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
