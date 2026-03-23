/**
 * Adapter seam boundary proofs for effect-search interop.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

const INTEROP_ROOT_PATH = "src/optimizers/effectSearchInterop/"
const EFFECT_SEARCH_INTERNAL_IMPORT_PATTERN = /from\s+["']effect-search\/internal\//
const M5_INTEROP_SURFACE_PATTERN =
  /Study\.open\(|Study\.ask\(|Study\.tell\(|Study\.fail\(|Study\.cancel\(|Study\.events\(|Study\.formatTerminalProgressEvent\(|Pareto\.|acquisition:\s*["'](?:ei|pi|thompson)["']/

const packageRootUrl = new URL("../../", import.meta.url)

const resolveProjectRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path

  return yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
})

const toForwardSlashes = (path: Path.Path, value: string): string => value.split(path.sep).join("/")

const listTypeScriptFilesInDir = (
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

const interopSurfaceLeakViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveProjectRoot
    const files = yield* listTypeScriptFilesInDir("src/optimizers")
    const findings = yield* Effect.forEach(files, (absolutePath) => {
      const relativePath = toForwardSlashes(path, path.relative(root, absolutePath))

      if (relativePath.startsWith(INTEROP_ROOT_PATH)) {
        return Effect.succeed(Option.none<string>())
      }

      return fileSystem.readFileString(absolutePath).pipe(
        Effect.orDie,
        Effect.map((source) =>
          M5_INTEROP_SURFACE_PATTERN.test(source)
            ? Option.some(relativePath)
            : Option.none<string>()
        )
      )
    })

    return Arr.filterMap(findings, (f) => f)
  }
)

const effectSearchInternalImportViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveProjectRoot
    const files = yield* listTypeScriptFilesInDir("src")
    const findings = yield* Effect.forEach(files, (absolutePath) =>
      fileSystem.readFileString(absolutePath).pipe(
        Effect.orDie,
        Effect.map((source) =>
          EFFECT_SEARCH_INTERNAL_IMPORT_PATTERN.test(source)
            ? Option.some(toForwardSlashes(path, path.relative(root, absolutePath)))
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

describe("integration/effectSearchInterop adapter boundary", () => {
  it.effect("exports the canonical effectSearchInterop seam from Optimizer barrels", () =>
    Effect.gen(function*() {
      const optimizerIndex = yield* readProjectFile("src/Optimizer/index.ts")
      const optimizerEventsIndex = yield* readProjectFile("src/Optimizer/events/index.ts")

      expect(optimizerIndex.includes("../optimizers/effectSearchInterop/index.js")).toBe(true)
      expect(optimizerEventsIndex.includes("./optimizer.js")).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps ask/tell + Pareto + acquisition capabilities single-sourced in the interop adapter", () =>
    Effect.gen(function*() {
      const interopIndex = yield* readProjectFile("src/optimizers/effectSearchInterop/index.ts")

      expect(interopIndex.length > 0).toBe(true)
      expect(yield* interopSurfaceLeakViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("blocks effect-search internal import leakage across the package", () =>
    Effect.gen(function*() {
      expect(yield* effectSearchInternalImportViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
