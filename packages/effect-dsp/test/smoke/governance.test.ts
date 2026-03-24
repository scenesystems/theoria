/**
 * Governance: public API surface, export boundary, and architectural invariant tests.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, HashMap, Number as Num, Option, Order, Record, Schema } from "effect"

const MAX_SOURCE_FILE_LINES = 240
const INTERNAL_IMPORT_PATTERN = /from\s+["'][^"']*internal\//
const PROVIDER_SDK_IMPORT_PATTERN =
  /from\s+["']@effect\/ai-(?:openai|anthropic|openrouter|google|vertex|bedrock|azure)[^"']*["']|import\(\s*["']@effect\/ai-(?:openai|anthropic|openrouter|google|vertex|bedrock|azure)[^"']*["']\s*\)/
const PROCESS_ENV_PATTERN = /\bprocess\.env\b/
const LANGUAGE_MODEL_RUNTIME_CALL_PATTERN = /LanguageModel\.(?:generateText|generateObject)\s*\(/
const MOCK_LANGUAGE_MODEL_PATTERN = /\bMockLanguageModel\b/
const EFFECT_SEARCH_INTEROP_M5_SURFACE_PATTERN =
  /Study\.open\(|Study\.ask\(|Study\.tell\(|Study\.fail\(|Study\.cancel\(|Study\.events\(|Study\.formatTerminalProgressEvent\(|Pareto\.|acquisition:\s*["'](?:ei|pi|thompson)["']/
const TRACE_INTERNAL_IMPORT_PATTERNS = [
  /from\s+["'][^"']*internal\/prompt\/trace[^"']*["']/,
  /from\s+["'][^"']*Module\/predict\/trace[^"']*["']/
]
const LEGACY_ALIAS_PATTERNS = [
  /export\s+(?:const|function)\s+effectful\b/,
  /export\s+type\s+AnyMetric\b/,
  /export\s+(?:const|function)\s+mipro\b/
]
const LEGACY_PROPOSAL_ALIAS_PATTERNS = [
  /export\s+(?:const|function)\s+proposeInstructions\b/,
  /export\s+(?:const|function)\s+phase2Propose\b/
]
const CANONICAL_MIPRO_TIPS = Arr.make("none", "creative", "simple", "description", "high_stakes", "persona")
const LEGACY_MIPRO_TIPS = Arr.make(
  "focus-on-facts",
  "contrast-alternatives",
  "prefer-short-answers",
  "explain-briefly"
)
const DETERMINISTIC_SEED_LITERAL_PATTERN = /1664525|1013904223|4294967296/
const DUPLICATED_HASH_CACHE_PATTERN = /\bblake3\b|@noble\/hashes|PartitionedSemaphore\.make|KeyValueStore\.layerMemory/
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
  pattern: RegExp
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          pattern.test(content)
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

const scanSourceForWithFilter = (
  pattern: RegExp,
  filterFn: (relativePath: string) => boolean
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          pattern.test(content) && filterFn(file.relative)
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

const scanSourceForAny = (
  patterns: ReadonlyArray<RegExp>
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          patterns.some((p) => p.test(content))
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  })

const internalBoundaryViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =
  scanSourceForWithFilter(
    INTERNAL_IMPORT_PATTERN,
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
          TRACE_INTERNAL_IMPORT_PATTERNS.some((p) => p.test(content))
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
        EFFECT_SEARCH_INTEROP_M5_SURFACE_PATTERN.test(content)
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
          PROCESS_ENV_PATTERN.test(content)
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  }
)

const duplicatedHashCacheViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =
  scanSourceForWithFilter(
    DUPLICATED_HASH_CACHE_PATTERN,
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
        const rootBarrel = yield* readProjectFile("src/index.ts")

        expect(rootBarrel.includes("export * as Cache from \"./Cache/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Errors from \"./Errors/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Evaluate from \"./Evaluate/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Example from \"./Example/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Metric from \"./Metric/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Module from \"./Module/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Optimizer from \"./Optimizer/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Signature from \"./Signature/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Trace from \"./Trace/index.js\"")).toBe(true)
        expect(rootBarrel.includes("export * as Runtime from \"./Runtime/index.js\"")).toBe(false)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins optimizer barrel to MIPROv2 and effect-search interop exports", () =>
      Effect.gen(function*() {
        const optimizerBarrel = yield* readProjectFile("src/Optimizer/index.ts")

        expect(optimizerBarrel.includes("./miprov2.js")).toBe(true)
        expect(optimizerBarrel.includes("../optimizers/effectSearchInterop/index.js")).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins optimizer events barrel to MIPROv2 and interop event schemas", () =>
      Effect.gen(function*() {
        const optimizerEventsBarrel = yield* readProjectFile("src/Optimizer/events/index.ts")

        expect(optimizerEventsBarrel.includes("./miprov2.js")).toBe(true)
        expect(optimizerEventsBarrel.includes("./optimizer.js")).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins public test harness export barrel", () =>
      Effect.gen(function*() {
        const testBarrel = yield* readProjectFile("src/testing/index.ts")

        expect(testBarrel.includes("./MockLanguageModel.js")).toBe(true)
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
        expect(yield* scanSourceForAny(LEGACY_ALIAS_PATTERNS)).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("prevents legacy proposal aliases from reappearing", () =>
      Effect.gen(function*() {
        expect(yield* scanSourceForAny(LEGACY_PROPOSAL_ALIAS_PATTERNS)).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins grounded proposer tip vocabulary to the canonical DSPy-aligned surface", () =>
      Effect.gen(function*() {
        const source = yield* readProjectFile("src/optimizers/MIPROv2/runtime/policy.ts")

        expect(Arr.every(CANONICAL_MIPRO_TIPS, (tip) => source.includes(`"${tip}"`))).toBe(true)
        expect(Arr.every(LEGACY_MIPRO_TIPS, (tip) => !source.includes(`"${tip}"`))).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps MIPRO exports and event boundaries canonical", () =>
      Effect.gen(function*() {
        const optimizerIndex = yield* readProjectFile("src/Optimizer/index.ts")
        const optimizerEventsIndex = yield* readProjectFile("src/Optimizer/events/index.ts")

        expect(optimizerIndex.includes("./miprov2.js")).toBe(true)
        expect(optimizerEventsIndex.includes("./miprov2.js")).toBe(true)

        const eventOwners = yield* scanSourceFor(/export const MIPROv2EventSchema/)

        expect(eventOwners).toEqual([MIPRO_EVENTS_CANONICAL_PATH])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps effect-search interop exports and event boundaries canonical", () =>
      Effect.gen(function*() {
        const optimizerIndex = yield* readProjectFile("src/Optimizer/index.ts")
        const optimizerEventsIndex = yield* readProjectFile("src/Optimizer/events/index.ts")

        expect(optimizerIndex.includes("../optimizers/effectSearchInterop/index.js")).toBe(true)
        expect(optimizerEventsIndex.includes("./optimizer.js")).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins effect-search interop event contracts to effect-search source-of-truth schemas", () =>
      Effect.gen(function*() {
        const source = yield* readProjectFile("src/optimizers/effectSearchInterop/model.ts")

        expect(source.includes("EffectSearchInteropEventSchema = StudyEvent.StudyEventSchema")).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("prevents M5 interop capability leakage outside canonical effectSearchInterop adapter", () =>
      Effect.gen(function*() {
        expect(yield* effectSearchInteropCapabilityLeakViolations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("pins objective projection seams to effect-search contracts", () =>
      Effect.gen(function*() {
        const source = yield* readProjectFile("src/contracts/ObjectiveProjection.ts")

        expect(source.includes("from \"effect-search/Contracts\"")).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps deterministic seed stepping delegated to effect-search shared contracts", () =>
      Effect.gen(function*() {
        const seedLiteralOwners = yield* scanSourceFor(DETERMINISTIC_SEED_LITERAL_PATTERN)

        expect(seedLiteralOwners).toEqual([])

        const seedContract = yield* readProjectFile("src/contracts/DeterministicSeed.ts")

        expect(seedContract.includes("from \"effect-search/Sampler\"")).toBe(true)
        expect(seedContract.includes("normalizeDeterministicSeed")).toBe(true)
        expect(seedContract.includes("nextDeterministicSeed")).toBe(true)
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps provider SDK imports outside src", () =>
      Effect.gen(function*() {
        expect(yield* scanSourceFor(PROVIDER_SDK_IMPORT_PATTERN)).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("forbids process.env in src and examples", () =>
      Effect.gen(function*() {
        expect(yield* processEnvViolations).toEqual([])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps src/internal/lm.ts as the sole runtime @effect/ai call site", () =>
      Effect.gen(function*() {
        const owners = yield* scanSourceFor(LANGUAGE_MODEL_RUNTIME_CALL_PATTERN)

        expect(Arr.sort(owners, Order.string)).toEqual([INTERNAL_LM_CANONICAL_PATH])
      }).pipe(Effect.provide(BunContext.layer)))

    it.effect("keeps MockLanguageModel implementation scoped to src/testing", () =>
      Effect.gen(function*() {
        const violations = yield* scanSourceForWithFilter(
          MOCK_LANGUAGE_MODEL_PATTERN,
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
