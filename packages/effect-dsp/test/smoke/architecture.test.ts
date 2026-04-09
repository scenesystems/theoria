/**
 * Architecture smoke checks for dependency-direction governance.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Option } from "effect"

class DependencyEdge extends Data.Class<{
  readonly from: string
  readonly to: string
  readonly specifier: string
}> {}

class SourceFilePath extends Data.Class<{
  readonly absolute: string
  readonly relative: string
}> {}

const IMPORT_PATTERN = /from\s+["']([^"']+)["']/g
const DYNAMIC_IMPORT_PATTERN = /import\(\s*["']([^"']+)["']\s*\)/g
const EFFECT_DIE_PATTERN = /Effect\.die\s*\(/
const TRACE_MODEL_PATTERN = /class\s+Entry\s+extends\s+Schema\.Class<Entry>\("TraceEntry"\)/
const MODULE_REGISTRY_PATTERN = /export\s+const\s+ModuleRegistryRef\s*:/
const EVALUATION_EVENT_PATTERN = /export\s+const\s+EvaluationEventSchema\s*=/
const EVALUATION_REPORT_PATTERN = /class\s+Report\s+extends\s+Schema\.Class<Report>\("EvaluationReport"\)/
const PARSE_POLICY_LITERAL_PATTERNS = [
  /maxRetries\s*:\s*(?:\d+|DEFAULT_PARSE_MAX_RETRIES)/,
  /retrySchedule\s*:\s*defaultParseRetrySchedule/,
  /feedbackTemplate\s*:\s*defaultParseFeedbackTemplate/
]
const TRACE_MODEL_CANONICAL_PATH = "src/Trace/model.ts"
const DISCOVERY_REGISTRY_CANONICAL_PATH = "src/Module/discovery/registry.ts"
const EVALUATION_EVENT_CANONICAL_PATH = "src/Evaluate/events.ts"
const EVALUATION_REPORT_CANONICAL_PATH = "src/Evaluate/report.ts"
const MIPRO_PUBLIC_FACADE_PATH = "src/Optimizer/miprov2.ts"
const EFFECT_SEARCH_INTEROP_ROOT_PATH = "src/optimizers/effectSearchInterop/"
const M5_INTEROP_SURFACE_PATTERN =
  /Study\.open\(|Study\.ask\(|Study\.tell\(|Study\.fail\(|Study\.cancel\(|Study\.events\(|Study\.ProgressLine\.projectEvent\(|Pareto\.|acquisition:\s*["'](?:ei|pi|thompson)["']/
const SEAM_CONTRACT_PATHS = [
  "src/contracts/ObjectiveProjection.ts",
  "src/contracts/TraceProjection.ts",
  "src/contracts/ModuleGraph.ts",
  "src/contracts/OptimizationSurface.ts"
]

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

const listSourceTypeScriptFiles: Effect.Effect<Array<SourceFilePath>, never, FileSystem.FileSystem | Path.Path> =
  listTypeScriptFilesInDir("src")

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

const projectFileExists = (
  relativePath: string
): Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveProjectRoot

    return yield* fileSystem.exists(path.join(root, relativePath)).pipe(Effect.orDie)
  })

const collectSpecifiers = (pattern: RegExp, source: string): ReadonlyArray<string> =>
  Arr.filterMap(Arr.fromIterable(source.matchAll(pattern)), (match) => Option.fromNullable(match[1]))

const resolveRelativeImport = (
  path: Path.Path,
  fileSystem: FileSystem.FileSystem,
  fromAbsolutePath: string,
  specifier: string,
  root: string
): Effect.Effect<Option.Option<string>> => {
  const basePath = path.resolve(path.dirname(fromAbsolutePath), specifier)
  const candidates: ReadonlyArray<string> = [`${basePath}.ts`, path.join(basePath, "index.ts")]

  return Effect.forEach(candidates, (candidate) =>
    fileSystem.exists(candidate).pipe(
      Effect.orDie,
      Effect.map((exists) =>
        exists
          ? Option.some(toForwardSlashes(path, path.relative(root, candidate)))
          : Option.none<string>()
      )
    )).pipe(
      Effect.map((results) => Option.firstSomeOf(results))
    )
}

const dependencyEdges: Effect.Effect<Array<DependencyEdge>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveProjectRoot
    const files = yield* listSourceTypeScriptFiles
    const allEdges = yield* Effect.forEach(files, (file) =>
      Effect.gen(function*() {
        const source = yield* fileSystem.readFileString(file.absolute).pipe(Effect.orDie)
        const specifiers = Arr.appendAll(
          collectSpecifiers(IMPORT_PATTERN, source),
          collectSpecifiers(DYNAMIC_IMPORT_PATTERN, source)
        )

        const edges = yield* Effect.forEach(
          Arr.filter(specifiers, (s) => s.startsWith(".")),
          (specifier) =>
            resolveRelativeImport(path, fileSystem, file.absolute, specifier, root).pipe(
              Effect.map((resolved) =>
                Option.map(
                  resolved,
                  (to): DependencyEdge => new DependencyEdge({ from: file.relative, to, specifier })
                )
              )
            )
        )

        return Arr.filterMap(edges, (edge) => edge)
      }))

    return Arr.flatten(allEdges)
  }
)

const patternOwners = (
  pattern: RegExp
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listSourceTypeScriptFiles
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

const isContractsPath = (value: string): boolean => value.startsWith("src/contracts/")
const isOptimizerImplementationPath = (value: string): boolean => value.startsWith("src/optimizers/")
const isInternalPath = (value: string): boolean => value.startsWith("src/internal/")

const isPublicNamespacePath = (value: string): boolean =>
  value === "src/index.ts" ||
  value === "src/Errors.ts" ||
  value === "src/Evaluate.ts" ||
  value === "src/Example.ts" ||
  value === "src/Metric.ts" ||
  value === "src/Module.ts" ||
  value === "src/Optimizer.ts" ||
  value === "src/Signature.ts" ||
  value === "src/Trace.ts" ||
  value === "src/contracts/index.ts" ||
  value === "src/testing/index.ts" ||
  /^src\/(Errors|Evaluate|Example|Metric|Module|Optimizer|Signature|Trace)\/index\.ts$/.test(value)

const formatEdge = (edge: DependencyEdge): string => `${edge.from} -> ${edge.to} (${edge.specifier})`

const contractsToOptimizerViolations = dependencyEdges.pipe(
  Effect.map((edges) =>
    Arr.filter(edges, (edge) => isContractsPath(edge.from) && isOptimizerImplementationPath(edge.to))
  ),
  Effect.map((edges) => Arr.map(edges, formatEdge))
)

const publicToInternalViolations = dependencyEdges.pipe(
  Effect.map((edges) => Arr.filter(edges, (edge) => isPublicNamespacePath(edge.from) && isInternalPath(edge.to))),
  Effect.map((edges) => Arr.map(edges, formatEdge))
)

const composeDiscoveryInternalViolations = dependencyEdges.pipe(
  Effect.map((edges) =>
    Arr.filter(
      edges,
      (edge) =>
        (edge.from.startsWith("src/Module/compose/") || edge.from.startsWith("src/Module/discovery/")) &&
        isInternalPath(edge.to)
    )
  ),
  Effect.map((edges) => Arr.map(edges, formatEdge))
)

const seamPurityViolations = dependencyEdges.pipe(
  Effect.map((edges) =>
    Arr.filter(
      edges,
      (edge) =>
        SEAM_CONTRACT_PATHS.includes(edge.from) &&
        (edge.to.startsWith("src/internal/") || edge.to.startsWith("src/Module/"))
    )
  ),
  Effect.map((edges) => Arr.map(edges, formatEdge))
)

const runtimeKernelOwnership: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFilesInDir("src/Module")
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          content.includes("export const PredictRuntime")
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  }
)

const traceModelOwnership = patternOwners(TRACE_MODEL_PATTERN)
const discoveryRegistryOwnership = patternOwners(MODULE_REGISTRY_PATTERN)
const evaluationEventOwnership = patternOwners(EVALUATION_EVENT_PATTERN)
const evaluationReportOwnership = patternOwners(EVALUATION_REPORT_PATTERN)

const deterministicMetricFoldOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const source = yield* readProjectFile("src/Evaluate/runtime/kernel.ts")

    if (source === "") return false

    return source.includes("const metrics = sortedMetricEntries(options.metrics)")
  }
)

const bootstrapFewShotLoopSemanticsOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect
  .gen(function*() {
    const coreSource = yield* readProjectFile("src/optimizers/BootstrapFewShot/index.ts")
    const roundSource = yield* readProjectFile("src/optimizers/BootstrapFewShot/runtime/round.ts")

    if (coreSource === "" || roundSource === "") return false

    return coreSource.includes("Effect.iterate(") &&
      roundSource.includes("Effect.forEach(") &&
      roundSource.includes("concurrency: \"inherit\"")
  })

const bootstrapFewShotTeacherLayerOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect
  .gen(function*() {
    const source = yield* readProjectFile("src/optimizers/BootstrapFewShot/runtime/round.ts")

    if (source === "") return false

    return source.includes("teacher") && source.includes("Effect.provide(")
  })

const bootstrapFewShotStreamingOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const source = yield* readProjectFile("src/optimizers/BootstrapFewShot/index.ts")

    if (source === "") return false

    return source.includes("from \"effect-search/Study\"") && source.includes("streamFromEmitter(")
  }
)

const bootstrapRsEffectSearchSeamOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect
  .gen(function*() {
    const source = yield* readProjectFile("src/optimizers/BootstrapRS/runtime/search.ts")

    if (source === "") return false

    return source.includes("from \"effect-search\"") && source.includes("Study.maximize(")
  })

const ensembleConcurrencyOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const source = yield* readProjectFile("src/optimizers/Ensemble/runtime.ts")

    if (source === "") return false

    return source.includes("Effect.forEach(") && source.includes("concurrency: selectedPrograms.length")
  }
)

const ensembleInternalBoundaryOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const source = yield* readProjectFile("src/optimizers/Ensemble/runtime.ts")

    if (source === "") return false

    return !source.includes("internal/")
  }
)

const miproPhase1Ownership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const source = yield* readProjectFile("src/optimizers/MIPROv2/bootstrap.ts")

    if (source === "") return false

    return source.includes("export class DemoCandidate") && source.includes("export class PredictorDemoCandidates")
  }
)

const miproPhase1LeakViolations = dependencyEdges.pipe(
  Effect.map((edges) =>
    Arr.filter(
      edges,
      (edge) =>
        edge.to === "src/optimizers/MIPROv2/bootstrap.ts" &&
        !(edge.from.startsWith("src/optimizers/MIPROv2/") || edge.from === MIPRO_PUBLIC_FACADE_PATH)
    )
  ),
  Effect.map((edges) => Arr.map(edges, formatEdge))
)

const miproSearchEffectSearchSeamOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect
  .gen(function*() {
    const searchSource = yield* readProjectFile("src/optimizers/MIPROv2/search.ts")
    const searchSpaceSource = yield* readProjectFile("src/optimizers/MIPROv2/runtime/search-space.ts")

    if (searchSource === "" || searchSpaceSource === "") return false

    return searchSource.includes("from \"effect-search\"") &&
      searchSpaceSource.includes("SearchSpace.categorical(") &&
      searchSource.includes("SearchSampler.tpe(") &&
      searchSource.includes("Study.maximize(")
  })

const miproSearchCadenceOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const searchSource = yield* readProjectFile("src/optimizers/MIPROv2/search.ts")
    const budgetSource = yield* readProjectFile("src/optimizers/MIPROv2/runtime/budget.ts")

    if (searchSource === "" || budgetSource === "") return false

    return budgetSource.includes("Option.getOrElse(Option.fromNullable(options.minibatchSize), () => 50)") &&
      budgetSource.includes("Option.getOrElse(Option.fromNullable(options.fullEvalEvery), () => 5)") &&
      budgetSource.includes("2 * safePredictorCount * Math.log(safeCandidateCount)") &&
      budgetSource.includes("(3 * safeCandidateCount) / 2") &&
      searchSource.includes("priorTrials: Arr.make(baselineResult.priorTrial)")
  }
)

const miproPhase3ModelOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const modelSource = yield* readProjectFile("src/optimizers/MIPROv2/phase3-model.ts")
    const searchSource = yield* readProjectFile("src/optimizers/MIPROv2/search.ts")
    const optionsSource = yield* readProjectFile("src/optimizers/MIPROv2/runtime/options.ts")

    if (modelSource === "" || searchSource === "" || optionsSource === "") return false

    return modelSource.includes("export class Phase3Diagnostics") &&
      modelSource.includes("export type RunPhase3SearchOptions") &&
      searchSource.includes("from \"./phase3-model.js\"") &&
      !searchSource.includes("export class Phase3Diagnostics") &&
      optionsSource.includes("from \"../phase3-model.js\"")
  }
)

const m5InteropAdapterOwnership: Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const adapterSource = yield* readProjectFile("src/optimizers/effectSearchInterop/adapter.ts")
    const askTellSource = yield* readProjectFile("src/optimizers/effectSearchInterop/askTell.ts")
    const progressSource = yield* readProjectFile("src/optimizers/effectSearchInterop/progress.ts")

    if (adapterSource === "" || askTellSource === "" || progressSource === "") return false

    return adapterSource.includes("from \"./askTell.js\"") &&
      adapterSource.includes("from \"./progress.js\"") &&
      askTellSource.includes("from \"effect-search\"") &&
      askTellSource.includes("Study.open(") &&
      askTellSource.includes("Study.ask(") &&
      askTellSource.includes("Study.tell(") &&
      askTellSource.includes("Pareto.") &&
      askTellSource.includes("acquisition:") &&
      progressSource.includes("Study.events(") &&
      progressSource.includes("Study.ProgressLine.projectEvent(")
  }
)

const m5InteropCapabilityLeakViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect
  .gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFilesInDir("src/optimizers")
    const findings = yield* Effect.forEach(files, (file) => {
      if (file.relative.startsWith(EFFECT_SEARCH_INTEROP_ROOT_PATH)) {
        return Effect.succeed(Option.none<string>())
      }

      return fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          M5_INTEROP_SURFACE_PATTERN.test(content)
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      )
    })

    return Arr.filterMap(findings, (f) => f)
  })

const parsePolicyLiteralViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const parsePolicyRuntimeFiles = [
      "src/Module/predict/runtime.ts",
      "src/Module/predict/strategy.ts"
    ]

    const results = yield* Effect.forEach(parsePolicyRuntimeFiles, (relativePath) =>
      Effect.gen(function*() {
        const source = yield* readProjectFile(relativePath)

        if (source === "") return []

        return Arr.filterMap(PARSE_POLICY_LITERAL_PATTERNS, (pattern) =>
          pattern.test(source)
            ? Option.some(`${relativePath} -> ${pattern.source}`)
            : Option.none<string>())
      }))

    return Arr.flatten(results)
  }
)

const publicHarnessDieViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFilesInDir("src/testing")
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          EFFECT_DIE_PATTERN.test(content)
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (f) => f)
  }
)

const isAllowedEdge = (from: string, to: string): boolean =>
  from.startsWith("src/Module/") && to.startsWith("src/contracts/")

describe("architecture", () => {
  it("encodes Module -> contracts as an allowed dependency edge", () => {
    expect(isAllowedEdge("src/Module/index.ts", "src/contracts/index.ts")).toBe(true)
  })

  it.effect("prevents contracts -> optimizers dependency edges", () =>
    Effect.gen(function*() {
      expect(yield* contractsToOptimizerViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("prevents public namespaces -> internal dependency edges", () =>
    Effect.gen(function*() {
      expect(yield* publicToInternalViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("forbids hardcoded parse-policy literals in runtime strategy paths", () =>
    Effect.gen(function*() {
      expect(yield* parsePolicyLiteralViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("forbids Effect.die in public testing harness behavior", () =>
    Effect.gen(function*() {
      expect(yield* publicHarnessDieViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces a single predict runtime ownership path", () =>
    Effect.gen(function*() {
      expect(yield* projectFileExists("src/Module/predict.ts")).toBe(false)
      expect(yield* projectFileExists("src/Module/predict/index.ts")).toBe(true)
      expect(yield* runtimeKernelOwnership).toEqual(["src/Module/predict/runtime.ts"])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces single ownership for trace model and discovery registry kernels", () =>
    Effect.gen(function*() {
      expect(yield* traceModelOwnership).toEqual([TRACE_MODEL_CANONICAL_PATH])
      expect(yield* discoveryRegistryOwnership).toEqual([DISCOVERY_REGISTRY_CANONICAL_PATH])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces single ownership for evaluation event/report contracts", () =>
    Effect.gen(function*() {
      expect(yield* evaluationEventOwnership).toEqual([EVALUATION_EVENT_CANONICAL_PATH])
      expect(yield* evaluationReportOwnership).toEqual([EVALUATION_REPORT_CANONICAL_PATH])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("forbids composition/discovery from importing internal runtime details", () =>
    Effect.gen(function*() {
      expect(yield* composeDiscoveryInternalViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces deterministic metric fold ordering in the shared evaluate kernel", () =>
    Effect.gen(function*() {
      expect(yield* deterministicMetricFoldOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces BootstrapFewShot iterate loop and inherited concurrency semantics", () =>
    Effect.gen(function*() {
      expect(yield* bootstrapFewShotLoopSemanticsOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces teacher-layer routing through Effect.provide in BootstrapFewShot", () =>
    Effect.gen(function*() {
      expect(yield* bootstrapFewShotTeacherLayerOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces BootstrapFewShot streaming through the shared effect-search stream bridge", () =>
    Effect.gen(function*() {
      expect(yield* bootstrapFewShotStreamingOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces BootstrapRS orchestration seam through effect-search Study primitives", () =>
    Effect.gen(function*() {
      expect(yield* bootstrapRsEffectSearchSeamOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces Ensemble execution via Effect.forEach with explicit selected-program concurrency", () =>
    Effect.gen(function*() {
      expect(yield* ensembleConcurrencyOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps Ensemble free of forbidden internal-path imports", () =>
    Effect.gen(function*() {
      expect(yield* ensembleInternalBoundaryOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps MIPRO Phase 1 contracts owned under the MIPRO namespace", () =>
    Effect.gen(function*() {
      expect(yield* miproPhase1Ownership).toBe(true)
      expect(yield* miproPhase1LeakViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces MIPRO Phase 3 search through effect-search categorical + TPE seams", () =>
    Effect.gen(function*() {
      expect(yield* miproSearchEffectSearchSeamOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("locks MIPRO Phase 3 budget formula and checkpoint governance defaults", () =>
    Effect.gen(function*() {
      expect(yield* miproSearchCadenceOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps MIPRO Phase 3 public contracts canonicalized in phase3-model", () =>
    Effect.gen(function*() {
      expect(yield* miproPhase3ModelOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces M5 effectSearchInterop adapter ownership for ask/tell, Pareto, acquisition, and progress", () =>
    Effect.gen(function*() {
      expect(yield* m5InteropAdapterOwnership).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("prevents M5 interop capability leakage outside the canonical effectSearchInterop adapter", () =>
    Effect.gen(function*() {
      expect(yield* m5InteropCapabilityLeakViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces seam purity for optimization contract projections", () =>
    Effect.gen(function*() {
      expect(yield* seamPurityViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
