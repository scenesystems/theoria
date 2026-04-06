/**
 * Governance: public API surface, export boundary, and architectural invariant tests.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, HashMap, Number as Num, Option, Order, Record, Schema } from "effect"
import type { SourceFile } from "typescript"

import {
  callExpressionTargets,
  exportedDeclarationNames,
  identifierNames,
  moduleSpecifiers,
  parseTypeScript,
  pathSegments,
  propertyAccessChains,
  propertyAssignmentTexts,
  referencesInternalBoundary,
  stringLiterals,
  variableInitializerTexts
} from "@theoria/source-proof"

type ParsedSourceFile = SourceFile

const MAX_SOURCE_FILE_LINES = 240
const CANONICAL_MIPRO_TIPS = Arr.make("none", "creative", "simple", "description", "high_stakes", "persona")
const LEGACY_MIPRO_TIPS = Arr.make(
  "focus-on-facts",
  "contrast-alternatives",
  "prefer-short-answers",
  "explain-briefly"
)
const CACHE_MODEL_CANONICAL_PATH = "src/Cache/model.ts"
const CACHE_LAYER_CANONICAL_PATH = "src/Cache/layer.ts"
const INTERNAL_LM_CANONICAL_PATH = "src/internal/lm.ts"
const MIPRO_EVENTS_CANONICAL_PATH = "src/optimizers/MIPROv2/events.ts"
const EFFECT_SEARCH_INTEROP_ROOT_PATH = "src/optimizers/effectSearchInterop/"

const OVERSIZE_SOURCE_FILE_NOTES: ReadonlyArray<readonly [string, string]> = [
  [
    "src/testing/MockLanguageModel.ts",
    "MockLanguageModel co-locates request routing, response construction, and effect-dsp-specific matchers for test isolation. Follow-up: split response builders into MockLanguageModel/responses.ts."
  ],
  [
    "src/Module/compose/graph.ts",
    "Module graph traversal co-locates DAG construction, cycle detection, topological sort, and serialization for deterministic compose module wiring. Follow-up: extract traversal into graph/traversal.ts."
  ],
  [
    "src/Module/parallel/runtime.ts",
    "Parallel batch execution currently co-locates branch failure-policy handling, nested trace and usage accumulation, and ordered result projection. Follow-up: extract branch evidence accumulation into runtime/evidence.ts."
  ],
  [
    "src/Optimizer/progress.ts",
    "Optimizer progress co-locates heterogeneous event streaming, terminal formatting, and progress aggregation. Follow-up: split terminal formatting into progress/format.ts."
  ],
  [
    "src/optimizers/BootstrapFewShot/runtime/round.ts",
    "Bootstrap round execution co-locates demo collection, threshold filtering, and teacher invocation. Follow-up: extract threshold filtering into runtime/threshold.ts."
  ],
  [
    "src/contracts/ArtifactEnvelope.ts",
    "Re-exports the full effect-search artifact envelope system. Follow-up: reduce surface after stabilization."
  ],
  [
    "src/Evaluate/runtime/example.ts",
    "Example evaluation co-locates predict invocation, metric scoring, and trace collection. Follow-up: extract metric scoring into runtime/scoring.ts."
  ],
  [
    "src/contracts/ModuleGraph.ts",
    "Module graph schema co-locates graph, node, and edge schemas for structural coherence. Follow-up: split into graph/schema.ts and graph/traversal.ts."
  ],
  [
    "src/optimizers/BootstrapRS/runtime/candidates.ts",
    "Random search candidate generation co-locates sampling, evaluation, and ranking. Follow-up: extract ranking into runtime/ranking.ts."
  ],
  [
    "src/optimizers/BootstrapFewShot/index.ts",
    "Bootstrap optimizer entry co-locates configuration schema, factory, and stream constructors. Follow-up: extract configuration into config.ts."
  ],
  [
    "src/optimizers/MIPROv2/runtime/search-space.ts",
    "MIPRO search space co-locates dimension construction, anchor binding, and categorical encoding. Follow-up: split anchor binding into runtime/anchors-binding.ts."
  ],
  [
    "src/optimizers/MIPROv2/runtime/evaluate.ts",
    "MIPRO evaluation co-locates trial execution, metric collection, and progress emission. Follow-up: extract progress emission into runtime/progress.ts."
  ],
  [
    "src/optimizers/COPRO/runtime/run.ts",
    "COPRO runtime currently co-locates step orchestration, candidate evaluation, resume snapshots, and predictor updates. Follow-up: extract step-level state transitions into runtime/step.ts."
  ]
]

const OVERSIZE_SOURCE_FILE_NOTES_MAP = HashMap.fromIterable(OVERSIZE_SOURCE_FILE_NOTES)

const ALLOWED_INTERNAL_IMPORT_PREFIXES = [
  "src/internal/",
  "src/optimizers/",
  "src/Module/",
  "src/Evaluate/"
]

const EXPECTED_EXPORT_KEYS = [
  ".",
  "./Signature",
  "./Module",
  "./Optimizer",
  "./Metric",
  "./Evaluate",
  "./Example",
  "./Trace",
  "./Errors",
  "./Cache",
  "./contracts",
  "./test",
  "./experimental",
  "./internal/*",
  "./optimizers/*"
]

const ManifestExportKeysSchema = Schema.parseJson(
  Schema.Struct({
    exports: Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    })
  })
)

class SourceFilePath extends Data.Class<{
  readonly absolute: string
  readonly relative: string
}> {}

const packageRootUrl = new URL("../../", import.meta.url)

const resolveProjectRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path

  return yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
})

const toForwardSlashes = (path: Path.Path, value: string): string => value.split(path.sep).join("/")

const toSourceFilePath = (
  path: Path.Path,
  root: string,
  absoluteSourceRoot: string,
  entry: string
): SourceFilePath => {
  const absolutePath = path.join(absoluteSourceRoot, entry)

  return new SourceFilePath({
    absolute: absolutePath,
    relative: toForwardSlashes(path, path.relative(root, absolutePath))
  })
}

const listTypeScriptFiles: Effect.Effect<Array<SourceFilePath>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveProjectRoot
    const absoluteSourceRoot = path.join(root, "src")
    const entries = yield* fileSystem.readDirectory(absoluteSourceRoot, { recursive: true }).pipe(Effect.orDie)

    return Arr.flatMap(entries, (entry) =>
      entry.endsWith(".ts")
        ? [toSourceFilePath(path, root, absoluteSourceRoot, entry)]
        : [])
  }
)

const listTypeScriptFilesInDir = (
  dirRelative: string
): Effect.Effect<Array<SourceFilePath>, never, FileSystem.FileSystem | Path.Path> =>
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
        ? [toSourceFilePath(path, root, absoluteDir, entry)]
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

const readParsedProjectFile = (
  relativePath: string
): Effect.Effect<ParsedSourceFile, never, FileSystem.FileSystem | Path.Path> =>
  readProjectFile(relativePath).pipe(Effect.map((source) => parseTypeScript(relativePath, source)))

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

const scanSourceFor = (
  predicate: (sourceFile: ParsedSourceFile) => boolean
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          predicate(parseTypeScript(file.relative, content))
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

const scanSourceForWithFilter = (
  predicate: (sourceFile: ParsedSourceFile) => boolean,
  filterFn: (relativePath: string) => boolean
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          predicate(parseTypeScript(file.relative, content)) && filterFn(file.relative)
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

const scanSourceForAny = (
  predicates: ReadonlyArray<(sourceFile: ParsedSourceFile) => boolean>
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          predicates.some((predicate) => predicate(parseTypeScript(file.relative, content)))
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

const internalBoundaryViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =
  scanSourceForWithFilter(
    (sourceFile) => moduleSpecifiers(sourceFile).some((specifier) => referencesInternalBoundary(specifier)),
    (relativePath) => !ALLOWED_INTERNAL_IMPORT_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  )

const packageExportGovernance: Effect.Effect<
  Readonly<{ readonly [key: string]: unknown }>,
  never,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function*() {
  const content = yield* readProjectFile("package.json")
  const decoded = yield* Schema.decodeUnknown(ManifestExportKeysSchema)(content).pipe(Effect.orDie)

  return decoded.exports
})

const packageExportKeys: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =
  packageExportGovernance.pipe(
    Effect.map((exportsMap) => Arr.sort(Record.keys(exportsMap), Order.string))
  )

const optimizerTraceBoundaryViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect
  .gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const optimizerFiles = yield* listTypeScriptFilesInDir("src/Optimizer")
    const optimizersFiles = yield* listTypeScriptFilesInDir("src/optimizers")
    const allFiles = Arr.appendAll(optimizerFiles, optimizersFiles)
    const findings = yield* Effect.forEach(allFiles, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          moduleSpecifiers(parseTypeScript(file.relative, content)).some(
              (specifier) =>
                pathSegments(specifier).join("/").includes("internal/prompt/trace")
                || pathSegments(specifier).join("/").includes("Module/predict/trace")
            )
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

const effectSearchInteropCapabilityLeakViolations: Effect.Effect<
  Array<string>,
  never,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const files = yield* listTypeScriptFilesInDir("src/optimizers")
  const findings = yield* Effect.forEach(files, (file) => {
    if (file.relative.startsWith(EFFECT_SEARCH_INTEROP_ROOT_PATH)) {
      return Effect.succeed(Option.none<string>())
    }

    return fileSystem.readFileString(file.absolute).pipe(
      Effect.orDie,
      Effect.map((content) =>
        (() => {
            const sourceFile = parseTypeScript(file.relative, content)
            return callExpressionTargets(sourceFile).some((target) =>
              target === "Study.open"
              || target === "Study.ask"
              || target === "Study.tell"
              || target === "Study.fail"
              || target === "Study.cancel"
              || target === "Study.events"
              || target === "Study.formatTerminalProgressEvent"
            )
              || propertyAccessChains(sourceFile).some((chain) => chain.startsWith("Pareto."))
              || propertyAssignmentTexts(sourceFile, "acquisition").length > 0
          })()
          ? Option.some(file.relative)
          : Option.none<string>()
      )
    )
  })

  return Arr.filterMap(findings, (f) => f)
})

const processEnvViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const srcFiles = yield* listTypeScriptFilesInDir("src")
    const exampleFiles = yield* listTypeScriptFilesInDir("examples")
    const allFiles = Arr.appendAll(srcFiles, exampleFiles)
    const findings = yield* Effect.forEach(allFiles, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          propertyAccessChains(parseTypeScript(file.relative, content)).includes("process.env")
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  }
)

const duplicatedHashCacheViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =
  scanSourceForWithFilter(
    (sourceFile) =>
      moduleSpecifiers(sourceFile).some((specifier) => specifier.includes("@noble/hashes"))
      || callExpressionTargets(sourceFile).some(
        (target) => target === "PartitionedSemaphore.make" || target === "KeyValueStore.layerMemory"
      )
      || stringLiterals(sourceFile).includes("blake3")
      || identifierNames(sourceFile).includes("blake3"),
    (relativePath) => relativePath !== CACHE_MODEL_CANONICAL_PATH && relativePath !== CACHE_LAYER_CANONICAL_PATH
  )

describe("Governance", () => {
  describe("file size", () => {
    it.effect("documents every src file over 240 LOC", () =>
      Effect.gen(function*() {
        const oversized = yield* oversizeSourceFindings
        const oversizedPaths = Arr.sort(Arr.map(oversized, (entry) => entry.path), Order.string)
        const documentedPaths = Arr.sort(Arr.map(OVERSIZE_SOURCE_FILE_NOTES, ([p]) => p), Order.string)

        expect(oversizedPaths).toEqual(documentedPaths)

        const undocumented = Arr.filter(oversized, (entry) => !HashMap.has(OVERSIZE_SOURCE_FILE_NOTES_MAP, entry.path))

        expect(undocumented).toEqual([])

        const emptyNotes = Arr.filter(OVERSIZE_SOURCE_FILE_NOTES, ([, note]) => note.trim().length <= 0)

        expect(emptyNotes).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))
  })

  describe("barrel exports", () => {
    it.effect("pins root namespace exports in src/index.ts", () =>
      Effect.gen(function*() {
        const rootBarrel = yield* readParsedProjectFile("src/index.ts")
        const barrelSpecifiers = moduleSpecifiers(rootBarrel)

        expect(barrelSpecifiers).toContain("./Cache/index.js")
        expect(barrelSpecifiers).toContain("./Errors/index.js")
        expect(barrelSpecifiers).toContain("./Evaluate/index.js")
        expect(barrelSpecifiers).toContain("./Example/index.js")
        expect(barrelSpecifiers).toContain("./Metric/index.js")
        expect(barrelSpecifiers).toContain("./Module/index.js")
        expect(barrelSpecifiers).toContain("./Optimizer/index.js")
        expect(barrelSpecifiers).toContain("./Signature/index.js")
        expect(barrelSpecifiers).toContain("./Trace/index.js")
        expect(barrelSpecifiers).not.toContain("./Runtime/index.js")
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins optimizer barrel to MIPROv2 and effect-search interop exports", () =>
      Effect.gen(function*() {
        const optimizerBarrel = yield* readParsedProjectFile("src/Optimizer/index.ts")

        expect(moduleSpecifiers(optimizerBarrel)).toContain("./miprov2.js")
        expect(moduleSpecifiers(optimizerBarrel)).toContain("../optimizers/effectSearchInterop/index.js")
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins optimizer events barrel to MIPROv2 and interop event schemas", () =>
      Effect.gen(function*() {
        const optimizerEventsBarrel = yield* readParsedProjectFile("src/Optimizer/events/index.ts")

        expect(moduleSpecifiers(optimizerEventsBarrel)).toContain("./miprov2.js")
        expect(moduleSpecifiers(optimizerEventsBarrel)).toContain("./optimizer.js")
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins public test harness export barrel", () =>
      Effect.gen(function*() {
        const testBarrel = yield* readParsedProjectFile("src/testing/index.ts")

        expect(moduleSpecifiers(testBarrel)).toContain("./MockLanguageModel.js")
      }).pipe(Effect.provide(BunContext.layer)))
  })

  describe("internal boundary", () => {
    it.effect("keeps internal imports behind approved subsystem boundaries", () =>
      Effect.gen(function*() {
        expect(yield* internalBoundaryViolations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("preserves explicit export-map governance", () =>
      Effect.gen(function*() {
        const exportsMap = yield* packageExportGovernance
        const exportKeys = yield* packageExportKeys

        expect(exportsMap["./internal/*"]).toBeNull()
        expect(exportsMap["./optimizers/*"]).toBeNull()
        expect(exportsMap["./*"]).toBeUndefined()
        expect(exportKeys).toEqual(Arr.sort(EXPECTED_EXPORT_KEYS, Order.string))
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("prevents optimizer namespaces from depending on trace internals", () =>
      Effect.gen(function*() {
        expect(yield* optimizerTraceBoundaryViolations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("forbids legacy metric/optimizer alias surface reintroduction", () =>
      Effect.gen(function*() {
        expect(
          yield* scanSourceForAny([
            (sourceFile) => exportedDeclarationNames(sourceFile).includes("effectful"),
            (sourceFile) => exportedDeclarationNames(sourceFile).includes("AnyMetric"),
            (sourceFile) => exportedDeclarationNames(sourceFile).includes("mipro")
          ])
        ).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("prevents legacy proposal aliases from reappearing", () =>
      Effect.gen(function*() {
        expect(
          yield* scanSourceForAny([
            (sourceFile) => exportedDeclarationNames(sourceFile).includes("proposeInstructions"),
            (sourceFile) => exportedDeclarationNames(sourceFile).includes("phase2Propose")
          ])
        ).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins grounded proposer tip vocabulary to the canonical DSPy-aligned surface", () =>
      Effect.gen(function*() {
        const sourceFile = yield* readParsedProjectFile("src/optimizers/MIPROv2/runtime/policy.ts")
        const literals = stringLiterals(sourceFile)

        expect(Arr.every(CANONICAL_MIPRO_TIPS, (tip) => literals.includes(tip))).toBe(true)
        expect(Arr.every(LEGACY_MIPRO_TIPS, (tip) => !literals.includes(tip))).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps MIPRO exports and event boundaries canonical", () =>
      Effect.gen(function*() {
        const optimizerIndex = yield* readParsedProjectFile("src/Optimizer/index.ts")
        const optimizerEventsIndex = yield* readParsedProjectFile("src/Optimizer/events/index.ts")

        expect(moduleSpecifiers(optimizerIndex)).toContain("./miprov2.js")
        expect(moduleSpecifiers(optimizerEventsIndex)).toContain("./miprov2.js")

        const eventOwners = yield* scanSourceFor((sourceFile) =>
          variableInitializerTexts(sourceFile, "MIPROv2EventSchema").length > 0
        )

        expect(eventOwners).toEqual([MIPRO_EVENTS_CANONICAL_PATH])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps effect-search interop exports and event boundaries canonical", () =>
      Effect.gen(function*() {
        const optimizerIndex = yield* readParsedProjectFile("src/Optimizer/index.ts")
        const optimizerEventsIndex = yield* readParsedProjectFile("src/Optimizer/events/index.ts")

        expect(moduleSpecifiers(optimizerIndex)).toContain("../optimizers/effectSearchInterop/index.js")
        expect(moduleSpecifiers(optimizerEventsIndex)).toContain("./optimizer.js")
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins effect-search interop event contracts to effect-search source-of-truth schemas", () =>
      Effect.gen(function*() {
        const sourceFile = yield* readParsedProjectFile("src/optimizers/effectSearchInterop/model.ts")

        expect(variableInitializerTexts(sourceFile, "EffectSearchInteropEventSchema")).toContain(
          "StudyEvent.StudyEventSchema"
        )
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("prevents M5 interop capability leakage outside canonical effectSearchInterop adapter", () =>
      Effect.gen(function*() {
        expect(yield* effectSearchInteropCapabilityLeakViolations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins objective projection seams to effect-search contracts", () =>
      Effect.gen(function*() {
        const sourceFile = yield* readParsedProjectFile("src/contracts/ObjectiveProjection.ts")

        expect(moduleSpecifiers(sourceFile)).toContain("effect-search/Contracts")
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps deterministic seed stepping delegated to effect-search shared contracts", () =>
      Effect.gen(function*() {
        const seedLiteralOwners = yield* scanSourceFor((sourceFile) =>
          stringLiterals(sourceFile).some(
            (literal) => literal === "1664525" || literal === "1013904223" || literal === "4294967296"
          ) || identifierNames(sourceFile).some(
            (identifier) => identifier === "1664525" || identifier === "1013904223" || identifier === "4294967296"
          )
        )

        expect(seedLiteralOwners).toEqual([])

        const seedContract = yield* readParsedProjectFile("src/contracts/DeterministicSeed.ts")

        expect(moduleSpecifiers(seedContract)).toContain("effect-search/Sampler")
        expect(exportedDeclarationNames(seedContract)).toContain("normalizeDeterministicSeed")
        expect(exportedDeclarationNames(seedContract)).toContain("nextDeterministicSeed")
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps provider SDK imports outside src", () =>
      Effect.gen(function*() {
        expect(
          yield* scanSourceFor((sourceFile) =>
            moduleSpecifiers(sourceFile).some((specifier) => specifier.startsWith("@effect/ai-"))
          )
        ).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("forbids process.env in src and examples", () =>
      Effect.gen(function*() {
        expect(yield* processEnvViolations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps src/internal/lm.ts as the sole runtime @effect/ai call site", () =>
      Effect.gen(function*() {
        const owners = yield* scanSourceFor((sourceFile) =>
          callExpressionTargets(sourceFile).some(
            (target) => target === "LanguageModel.generateText" || target === "LanguageModel.generateObject"
          )
        )

        expect(Arr.sort(owners, Order.string)).toEqual([INTERNAL_LM_CANONICAL_PATH])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps MockLanguageModel implementation scoped to src/testing", () =>
      Effect.gen(function*() {
        const violations = yield* scanSourceForWithFilter(
          (sourceFile) => identifierNames(sourceFile).includes("MockLanguageModel"),
          (relativePath) => !relativePath.startsWith("src/testing/")
        )

        expect(violations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("prevents duplicated hash/cache implementation in effect-dsp src", () =>
      Effect.gen(function*() {
        expect(yield* duplicatedHashCacheViolations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))
  })
})
