/**
 * Adapter seam boundary proofs for effect-search interop.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import {
  callExpressionTargets,
  moduleSpecifiers,
  parseTypeScript,
  pathSegments,
  propertyAccessChains
} from "@theoria/source-proof"

const INTEROP_ROOT_PATH = "src/optimizers/effectSearchInterop/"

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

const hasInteropCapability = (filePath: string, source: string): boolean => {
  const parsed = parseTypeScript(filePath, source)
  const callTargets = callExpressionTargets(parsed)
  const propertyChains = propertyAccessChains(parsed)

  return callTargets.some((target) =>
    target === "Study.open"
    || target === "Study.ask"
    || target === "Study.tell"
    || target === "Study.fail"
    || target === "Study.cancel"
    || target === "Study.events"
    || target === "Study.ProgressLine.projectEvent"
  )
    || propertyChains.some((chain) => chain.startsWith("Pareto."))
}

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
          hasInteropCapability(relativePath, source)
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
        Effect.map((source) => {
          const parsed = parseTypeScript(absolutePath, source)

          return moduleSpecifiers(parsed).some((specifier) => {
              const segments = pathSegments(specifier)
              return segments[0] === "effect-search" && segments[1] === "internal"
            })
            ? Option.some(toForwardSlashes(path, path.relative(root, absolutePath)))
            : Option.none<string>()
        })
      ))

    return Arr.filterMap(findings, (f) => f)
  })

describe("integration/effectSearchInterop adapter boundary", () => {
  it.effect("exports the canonical effectSearchInterop seam from Optimizer barrels", () =>
    Effect.gen(function*() {
      const optimizerIndex = parseTypeScript("src/Optimizer/index.ts", yield* readProjectFile("src/Optimizer/index.ts"))
      const optimizerEventsIndex = parseTypeScript(
        "src/Optimizer/events/index.ts",
        yield* readProjectFile("src/Optimizer/events/index.ts")
      )

      expect(moduleSpecifiers(optimizerIndex)).toContain("../optimizers/effectSearchInterop/index.js")
      expect(moduleSpecifiers(optimizerEventsIndex)).toContain("./optimizer.js")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps ask/tell + Pareto + acquisition capabilities single-sourced in the interop adapter", () =>
    Effect.gen(function*() {
      const interopIndex = parseTypeScript(
        "src/optimizers/effectSearchInterop/index.ts",
        yield* readProjectFile("src/optimizers/effectSearchInterop/index.ts")
      )
      const adapter = parseTypeScript(
        "src/optimizers/effectSearchInterop/adapter.ts",
        yield* readProjectFile("src/optimizers/effectSearchInterop/adapter.ts")
      )

      expect(moduleSpecifiers(interopIndex)).toContain("./adapter.js")
      expect(moduleSpecifiers(interopIndex)).toContain("./model.js")
      expect(moduleSpecifiers(adapter)).toContain("./askTell.js")
      expect(moduleSpecifiers(adapter)).toContain("./progress.js")
      expect(yield* interopSurfaceLeakViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("blocks effect-search internal import leakage across the package", () =>
    Effect.gen(function*() {
      expect(yield* effectSearchInternalImportViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
