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

const OVERSIZE_SOURCE_FILE_NOTES: ReadonlyArray<readonly [string, string]> = [
  [
    "src/Cache/schemaCache.ts",
    "Schema cache authority currently co-locates shared resolve semantics, SQLite key-value adapter wiring, and cache-layer constructors to preserve one deterministic persistence kernel. Follow-up: extract SQLite authority setup into `Cache/sqliteAuthority.ts` and isolate resolve single-flight helpers into `Cache/resolve.ts` while keeping `schemaCache.ts` as public composition entrypoint."
  ],
  [
    "src/Sampler/weighted.ts",
    "Weighted single-draw selection, deterministic replay sampling, and pair sampling remain co-located to preserve one auditable seed-stepping and fallback-policy kernel. Follow-up: split fallback helpers into `Sampler/weightedFallback.ts` and pair orchestration into `Sampler/weightedPair.ts` after sampler API stabilization."
  ],
  [
    "src/Study/index.ts",
    "Study public API barrel re-exports all study surface types, constructors, and operations. Follow-up: reduce by splitting ask/tell and snapshot re-exports into sub-barrels."
  ],
  [
    "src/contracts/ArtifactRelation.ts",
    "Artifact relation schemas and constructors co-located for tagged union coherence. Follow-up: split relation constructors into focused modules after contract stabilization."
  ],
  [
    "src/samplers/Tpe/dimensions/categorical.ts",
    "TPE categorical dimension co-locates univariate and multivariate Parzen suggestion, trace construction, and candidate selection. Size driven by multi-line JSDoc on all exports."
  ],
  [
    "src/samplers/Tpe/dimensions/float.ts",
    "TPE float dimension co-locates log-scale model, Parzen estimation, trace construction, and normalization. Size driven by multi-line JSDoc on all exports."
  ],
  [
    "src/samplers/Tpe/mixed.ts",
    "TPE mixed-space joint scoring co-locates per-dimension dispatch, joint acquisition scoring, and candidate selection. Size driven by multi-line JSDoc on all exports."
  ],
  [
    "src/samplers/Tpe/multivariateContinuous/adapters.ts",
    "Multivariate continuous adapters co-locate model transforms, vector extraction, and normalization for all numeric distribution types. Size driven by multi-line JSDoc on all exports."
  ],
  [
    "src/samplers/Tpe/options.ts",
    "TPE option parsing co-locates default resolution, validation, and checkpoint projection for all sampler configuration fields. Size driven by multi-line JSDoc on all exports."
  ]
]

const OVERSIZE_SOURCE_FILE_NOTES_MAP = HashMap.fromIterable(OVERSIZE_SOURCE_FILE_NOTES)

const INTERNAL_IMPORT_ALLOWED_PREFIXES = [
  "src/internal/",
  "src/samplers/",
  "src/Sampler/",
  "src/Study/",
  "src/experimental/"
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
  "./package.json",
  ".",
  "./Cache",
  "./Contracts",
  "./Errors",
  "./Experimental",
  "./Pareto",
  "./Sampler",
  "./Scheduler",
  "./SearchSpace",
  "./Study",
  "./StudyEvent",
  "./Trial",
  "./contracts",
  "./experimental",
  "./internal/*"
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

const hasAllowedInternalPrefix = (path: string): boolean =>
  INTERNAL_IMPORT_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))

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
          && !hasAllowedInternalPrefix(file.relative)
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

const packageExportGovernance: Effect.Effect<
  Readonly<{ readonly [key: string]: unknown }>,
  never,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* resolveRootFrom(packageRootUrl)
  const packageJsonPath = path.join(root, "package.json")
  const packageJson = yield* fileSystem.readFileString(packageJsonPath).pipe(Effect.orDie)
  const decoded = yield* Schema.decodeUnknown(ManifestExportKeysSchema)(packageJson).pipe(Effect.orDie)

  return decoded.exports
})

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

  it.effect("keeps internal imports behind approved subsystem boundaries", () =>
    Effect.gen(function*() {
      expect(yield* internalBoundaryViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("preserves layered export governance contracts", () =>
    Effect.gen(function*() {
      const exportMap = yield* packageExportGovernance
      const exportKeys = yield* packageExportKeys

      expect(exportMap["./package.json"]).toBe("./package.json")
      expect(exportMap["."]).toBe("./src/index.ts")
      expect(exportMap["./Cache"]).toBe("./src/Cache/index.ts")
      expect(exportMap["./Contracts"]).toBe("./src/contracts/index.ts")
      expect(exportMap["./Errors"]).toBe("./src/Errors/index.ts")
      expect(exportMap["./Experimental"]).toBe("./src/experimental/index.ts")
      expect(exportMap["./Pareto"]).toBe("./src/Pareto/index.ts")
      expect(exportMap["./Sampler"]).toBe("./src/Sampler/index.ts")
      expect(exportMap["./Scheduler"]).toBe("./src/Scheduler/index.ts")
      expect(exportMap["./SearchSpace"]).toBe("./src/SearchSpace/index.ts")
      expect(exportMap["./Study"]).toBe("./src/Study/index.ts")
      expect(exportMap["./StudyEvent"]).toBe("./src/StudyEvent/index.ts")
      expect(exportMap["./Trial"]).toBe("./src/Trial/index.ts")
      expect(exportMap["./contracts"]).toBe("./src/contracts/index.ts")
      expect(exportMap["./experimental"]).toBe("./src/experimental/index.ts")
      expect(exportMap["./internal/*"]).toBeNull()
      expect(exportKeys).toEqual(Arr.sort(EXPECTED_EXPORT_KEYS, Order.string))
    }).pipe(Effect.provide(BunContext.layer)))
})
