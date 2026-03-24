import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export const INTERNAL_EXPORT_DENIAL_SUBPATH = "./internal/*"
export const MONOREPO_TOPOLOGY_TODO_CODE = "metadata.monorepo.topology-todo"

const ROOT_PACKAGE_JSON = "package.json"
const PACKED_PACKAGE_JSON = "dist/package.json"
const README_PATH = "README.md"

const MONOREPO_REPOSITORY_URL = "https://github.com/scenesystems/theoria.git"
const MONOREPO_REPOSITORY_DIRECTORY = "packages/effect-search"
const MONOREPO_HOMEPAGE = "https://github.com/scenesystems/theoria/tree/main/packages/effect-search"

const FORBIDDEN_REPOSITORY_URL_FRAGMENTS = ["github.com/scenesystems/eva", "github.com/scenesystems/eva.git"]

const REQUIRED_RELEASE_README_PHRASES = ["publish:check", "changeset-publish --dry-run"]

const REQUIRED_ROOT_EXPORT_TARGETS = {
  "./package.json": "./package.json",
  ".": "./src/index.ts",
  "./Cache": "./src/Cache/index.ts",
  "./Contracts": "./src/contracts/index.ts",
  "./Errors": "./src/Errors/index.ts",
  "./Experimental": "./src/experimental/index.ts",
  "./Pareto": "./src/Pareto/index.ts",
  "./Sampler": "./src/Sampler/index.ts",
  "./Scheduler": "./src/Scheduler/index.ts",
  "./SearchSpace": "./src/SearchSpace/index.ts",
  "./Study": "./src/Study/index.ts",
  "./StudyEvent": "./src/StudyEvent/index.ts",
  "./Trial": "./src/Trial/index.ts",
  "./contracts": "./src/contracts/index.ts",
  "./experimental": "./src/experimental/index.ts",
  [INTERNAL_EXPORT_DENIAL_SUBPATH]: null
} as const

const REQUIRED_PACKED_EXPORT_SUBPATHS = Object.keys(REQUIRED_ROOT_EXPORT_TARGETS)

export const REQUIRED_KEYWORDS = [
  "effect",
  "optimization",
  "bayesian-optimization",
  "black-box-optimization",
  "hyperparameter-optimization",
  "tpe",
  "motpe",
  "hyperband",
  "bohb",
  "pareto"
] as const

type ExportTarget = string | null | Readonly<Record<string, unknown>>
type ExportMap = Readonly<Record<string, ExportTarget>>

type RepositoryObject = {
  readonly type?: unknown
  readonly url?: unknown
  readonly directory?: unknown
}

type PackageScripts = Readonly<Record<string, unknown>>

export type PackageManifest = {
  readonly repository?: unknown
  readonly homepage?: unknown
  readonly keywords?: unknown
  readonly exports?: unknown
  readonly scripts?: unknown
}

export type PublishReadinessIssue = {
  readonly code: string
  readonly message: string
}

export type PublishReadinessReport = {
  readonly errors: ReadonlyArray<PublishReadinessIssue>
  readonly todos: ReadonlyArray<PublishReadinessIssue>
}

type PublishReadinessOptions = {
  readonly requirePackedManifest?: boolean
  readonly enforceMonorepoTopology?: boolean
}

type PublishReadinessInput = {
  readonly rootManifest: PackageManifest
  readonly packedManifest?: PackageManifest
  readonly readmeText?: string
  readonly options?: PublishReadinessOptions
}

const asRecord = (input: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof input === "object" && input !== null && !Array.isArray(input)
    ? input
    : undefined

const asString = (input: unknown): string | undefined =>
  typeof input === "string"
    ? input
    : undefined

const asStringArray = (input: unknown): ReadonlyArray<string> | undefined =>
  Array.isArray(input) && input.every((item) => typeof item === "string")
    ? input
    : undefined

const asRepositoryObject = (input: unknown): RepositoryObject | undefined =>
  asRecord(input)

const asExportMap = (input: unknown): ExportMap | undefined =>
  asRecord(input)

const asScripts = (input: unknown): PackageScripts | undefined =>
  asRecord(input)

const hasOwn = (record: Readonly<Record<string, unknown>>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key)

const isPackedExportTarget = (subpath: string, target: unknown): boolean => {
  if (subpath === "./package.json") {
    return target === "./package.json"
  }

  if (subpath === INTERNAL_EXPORT_DENIAL_SUBPATH) {
    return target === null
  }

  const record = asRecord(target)
  if (record === undefined) {
    return false
  }

  return typeof record.types === "string" && typeof record.import === "string" && typeof record.default === "string"
}

const distinct = <A>(items: ReadonlyArray<A>): ReadonlyArray<A> =>
  Array.from(new Set(items))

const checkRepositoryMetadata = (
  rootManifest: PackageManifest,
  options: PublishReadinessOptions
): PublishReadinessReport => {
  const errors: Array<PublishReadinessIssue> = []
  const todos: Array<PublishReadinessIssue> = []

  const repository = asRepositoryObject(rootManifest.repository)
  const homepage = asString(rootManifest.homepage)

  if (repository === undefined) {
    errors.push({
      code: "metadata.repository.object-missing",
      message: "package.json.repository must be an object with type/url metadata"
    })

    return { errors, todos }
  }

  if (repository.type !== "git") {
    errors.push({
      code: "metadata.repository.type-invalid",
      message: "package.json.repository.type must be \"git\""
    })
  }

  const repositoryUrl = asString(repository.url)
  if (repositoryUrl === undefined) {
    errors.push({
      code: "metadata.repository.url-missing",
      message: "package.json.repository.url must be a string"
    })
  }

  if (repositoryUrl !== undefined && FORBIDDEN_REPOSITORY_URL_FRAGMENTS.some((fragment) => repositoryUrl.includes(fragment))) {
    errors.push({
      code: "metadata.repository.url-forbidden",
      message: "package.json.repository.url cannot point at scenesystems/eva"
    })
  }

  if (homepage === undefined) {
    errors.push({
      code: "metadata.homepage.missing",
      message: "package.json.homepage must be a string"
    })
  }

  const hasMonorepoTarget =
    repositoryUrl === MONOREPO_REPOSITORY_URL &&
    repository.directory === MONOREPO_REPOSITORY_DIRECTORY &&
    homepage === MONOREPO_HOMEPAGE

  if (!hasMonorepoTarget && options.enforceMonorepoTopology === true) {
    errors.push({
      code: "metadata.monorepo.target-mismatch",
      message:
        `repository.url/repository.directory/homepage must match ${MONOREPO_REPOSITORY_URL} + ${MONOREPO_REPOSITORY_DIRECTORY}`
    })
  }

  if (!hasMonorepoTarget && options.enforceMonorepoTopology !== true) {
    todos.push({
      code: MONOREPO_TOPOLOGY_TODO_CODE,
      message:
        "repository.url + repository.directory + homepage should match scenesystems/theoria monorepo layout"
    })
  }

  return { errors, todos }
}

const checkRootExportContract = (rootManifest: PackageManifest): PublishReadinessReport => {
  const errors: Array<PublishReadinessIssue> = []

  const exportMap = asExportMap(rootManifest.exports)
  if (exportMap === undefined) {
    return {
      errors: [
        {
          code: "exports.root.map-missing",
          message: "package.json.exports must be an object"
        }
      ],
      todos: []
    }
  }

  if (hasOwn(exportMap, "./*")) {
    errors.push({
      code: "exports.root.wildcard-forbidden",
      message: "package.json.exports cannot include wildcard subpath './*'"
    })
  }

  const missingSubpaths = Object.keys(REQUIRED_ROOT_EXPORT_TARGETS).filter((subpath) => !hasOwn(exportMap, subpath))
  if (missingSubpaths.length > 0) {
    errors.push({
      code: "exports.root.missing-subpaths",
      message: `package.json.exports is missing required subpaths: ${missingSubpaths.join(", ")}`
    })
  }

  const targetMismatches = Object.entries(REQUIRED_ROOT_EXPORT_TARGETS).flatMap(([subpath, expectedTarget]) =>
    hasOwn(exportMap, subpath) && exportMap[subpath] !== expectedTarget
      ? [
          `${subpath}: expected ${String(expectedTarget)} but found ${String(exportMap[subpath])}`
        ]
      : []
  )

  if (targetMismatches.length > 0) {
    errors.push({
      code: "exports.root.target-mismatch",
      message: `package.json.exports has target drift (${targetMismatches.join("; ")})`
    })
  }

  return { errors, todos: [] }
}

const checkPackedExportContract = (
  packedManifest: PackageManifest | undefined,
  options: PublishReadinessOptions
): PublishReadinessReport => {
  if (packedManifest === undefined && options.requirePackedManifest === true) {
    return {
      errors: [
        {
          code: "exports.packed.manifest-missing",
          message: "dist/package.json is required for packed export contract checks"
        }
      ],
      todos: []
    }
  }

  if (packedManifest === undefined) {
    return { errors: [], todos: [] }
  }

  const exportMap = asExportMap(packedManifest.exports)
  if (exportMap === undefined) {
    return {
      errors: [
        {
          code: "exports.packed.map-missing",
          message: "dist/package.json.exports must be an object"
        }
      ],
      todos: []
    }
  }

  const errors: Array<PublishReadinessIssue> = []

  if (hasOwn(exportMap, "./*")) {
    errors.push({
      code: "exports.packed.wildcard-forbidden",
      message: "dist/package.json.exports cannot include wildcard subpath './*'"
    })
  }

  const missingSubpaths = REQUIRED_PACKED_EXPORT_SUBPATHS.filter((subpath) => !hasOwn(exportMap, subpath))
  if (missingSubpaths.length > 0) {
    errors.push({
      code: "exports.packed.missing-subpaths",
      message: `dist/package.json.exports is missing required subpaths: ${missingSubpaths.join(", ")}`
    })
  }

  if (!hasOwn(exportMap, INTERNAL_EXPORT_DENIAL_SUBPATH) || exportMap[INTERNAL_EXPORT_DENIAL_SUBPATH] !== null) {
    errors.push({
      code: "exports.packed.internal-denial",
      message: "dist/package.json.exports must preserve './internal/*': null denial"
    })
  }

  const malformedTargets = REQUIRED_PACKED_EXPORT_SUBPATHS.flatMap((subpath) =>
    hasOwn(exportMap, subpath) && !isPackedExportTarget(subpath, exportMap[subpath])
      ? [subpath]
      : []
  )

  if (malformedTargets.length > 0) {
    errors.push({
      code: "exports.packed.target-malformed",
      message:
        `dist/package.json.exports has malformed target entries for: ${malformedTargets.join(", ")}`
    })
  }

  if (hasOwn(exportMap, "./Cache")) {
    const cacheEntry = asRecord(exportMap["./Cache"])
    if (cacheEntry !== undefined) {
      if (cacheEntry.types !== "./dist/dts/Cache/index.d.ts") {
        errors.push({
          code: "exports.packed.cache-types-target-invalid",
          message: "dist/package.json.exports ./Cache.types must equal ./dist/dts/Cache/index.d.ts"
        })
      }
      if (cacheEntry.import !== "./dist/esm/Cache/index.js") {
        errors.push({
          code: "exports.packed.cache-import-target-invalid",
          message: "dist/package.json.exports ./Cache.import must equal ./dist/esm/Cache/index.js"
        })
      }
      if (cacheEntry.default !== "./dist/cjs/Cache/index.js") {
        errors.push({
          code: "exports.packed.cache-default-target-invalid",
          message: "dist/package.json.exports ./Cache.default must equal ./dist/cjs/Cache/index.js"
        })
      }
    }
  }

  return { errors, todos: [] }
}

const checkKeywordCoverage = (rootManifest: PackageManifest): PublishReadinessReport => {
  const keywords = asStringArray(rootManifest.keywords)
  if (keywords === undefined) {
    return {
      errors: [
        {
          code: "keywords.array-missing",
          message: "package.json.keywords must be an array of strings"
        }
      ],
      todos: []
    }
  }

  const normalized = new Set(keywords.map((keyword) => keyword.toLowerCase()))
  const missing = REQUIRED_KEYWORDS.filter((keyword) => !normalized.has(keyword))

  return missing.length === 0
    ? { errors: [], todos: [] }
    : {
        errors: [
          {
            code: "keywords.required-missing",
            message: `package.json.keywords is missing: ${missing.join(", ")}`
          }
        ],
        todos: []
      }
}

const checkScriptWiring = (rootManifest: PackageManifest): PublishReadinessReport => {
  const scripts = asScripts(rootManifest.scripts)
  if (scripts === undefined) {
    return {
      errors: [
        {
          code: "scripts.map-missing",
          message: "package.json.scripts must be an object"
        }
      ],
      todos: []
    }
  }

  const publishCheck = asString(scripts["publish:check"])
  const changesetPublish = asString(scripts["changeset-publish"])

  const errors = distinct(
    [
      publishCheck === undefined
        ? {
            code: "scripts.publish-check.missing",
            message: "package.json.scripts must define publish:check"
          }
        : undefined,
      changesetPublish === undefined
        ? {
            code: "scripts.changeset-publish.missing",
            message: "package.json.scripts must define changeset-publish"
          }
        : undefined,
      changesetPublish !== undefined && !changesetPublish.includes("publish:check")
        ? {
            code: "scripts.changeset-publish.missing-contract-check",
            message: "changeset-publish must execute publish:check before publish"
          }
        : undefined
    ].filter((issue): issue is PublishReadinessIssue => issue !== undefined)
  )

  return { errors, todos: [] }
}

const checkReleaseDocs = (readmeText: string | undefined): PublishReadinessReport => {
  if (readmeText === undefined) {
    return { errors: [], todos: [] }
  }

  const missingPhrases = REQUIRED_RELEASE_README_PHRASES.filter((phrase) => !readmeText.includes(phrase))

  return missingPhrases.length === 0
    ? { errors: [], todos: [] }
    : {
        errors: [
          {
            code: "docs.release-checklist.missing",
            message: `README release checklist must include: ${missingPhrases.join(", ")}`
          }
        ],
        todos: []
      }
}

export const publishReadinessReport = (input: PublishReadinessInput): PublishReadinessReport => {
  const options = input.options ?? {}

  const repository = checkRepositoryMetadata(input.rootManifest, options)
  const rootExports = checkRootExportContract(input.rootManifest)
  const packedExports = checkPackedExportContract(input.packedManifest, options)
  const keywords = checkKeywordCoverage(input.rootManifest)
  const scripts = checkScriptWiring(input.rootManifest)
  const docs = checkReleaseDocs(input.readmeText)

  return {
    errors: [
      ...repository.errors,
      ...rootExports.errors,
      ...packedExports.errors,
      ...keywords.errors,
      ...scripts.errors,
      ...docs.errors
    ],
    todos: [...repository.todos, ...rootExports.todos, ...packedExports.todos, ...keywords.todos, ...scripts.todos, ...docs.todos]
  }
}

export const loadManifestFromFile = (filePath: string): PackageManifest => {
  const content = readFileSync(filePath, "utf8")
  const parsed = JSON.parse(content)

  return asRecord(parsed) ?? {}
}

const loadManifestIfPresent = (filePath: string): PackageManifest | undefined =>
  existsSync(filePath)
    ? loadManifestFromFile(filePath)
    : undefined

const sourcePathToPackedModule = (sourcePath: string): string | undefined => {
  if (!sourcePath.startsWith("./src/") || !sourcePath.endsWith(".ts")) {
    return undefined
  }

  return sourcePath.slice("./src/".length, -".ts".length)
}

const packedTargetFromRootTarget = (subpath: string, target: unknown): ExportTarget => {
  if (subpath === "./package.json") {
    return "./package.json"
  }

  if (target === null) {
    return null
  }

  if (typeof target !== "string") {
    return null
  }

  const modulePath = sourcePathToPackedModule(target)
  if (modulePath === undefined) {
    return null
  }

  return {
    types: `./dist/dts/${modulePath}.d.ts`,
    import: `./dist/esm/${modulePath}.js`,
    default: `./dist/cjs/${modulePath}.js`
  }
}

const ensurePackedInternalDenial = (manifest: PackageManifest): PackageManifest => {
  const exportMap = asExportMap(manifest.exports)
  if (exportMap === undefined) {
    return manifest
  }

  const alreadyDenied = hasOwn(exportMap, INTERNAL_EXPORT_DENIAL_SUBPATH) && exportMap[INTERNAL_EXPORT_DENIAL_SUBPATH] === null
  if (alreadyDenied) {
    return manifest
  }

  return {
    ...manifest,
    exports: {
      ...exportMap,
      [INTERNAL_EXPORT_DENIAL_SUBPATH]: null
    }
  }
}

export const buildPackedManifestFixture = (rootManifest: PackageManifest): PackageManifest => {
  const exportMap = asExportMap(rootManifest.exports) ?? {}
  const packedExports = Object.fromEntries(
    Object.entries(exportMap).map(([subpath, target]) => [subpath, packedTargetFromRootTarget(subpath, target)])
  )

  return {
    exports: {
      ...packedExports,
      [INTERNAL_EXPORT_DENIAL_SUBPATH]: null
    }
  }
}

const synchronizePackedManifest = (packedPath: string): void => {
  const packedManifest = loadManifestIfPresent(packedPath)

  if (packedManifest === undefined) {
    return
  }

  const nextPackedManifest = ensurePackedInternalDenial(packedManifest)

  if (nextPackedManifest !== packedManifest) {
    writeFileSync(packedPath, `${JSON.stringify(nextPackedManifest, null, 2)}\n`, "utf8")
  }
}

const readFlagValue = (argv: ReadonlyArray<string>, flag: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`${flag}=`))
    ?.slice(flag.length + 1)

const parseFlags = (argv: ReadonlyArray<string>) => {
  const args = new Set(argv)

  return {
    requirePackedManifest: args.has("--require-packed-manifest"),
    enforceMonorepoTopology: args.has("--enforce-monorepo-topology"),
    syncPackedManifest: args.has("--sync-packed-manifest"),
    rootManifestPath: readFlagValue(argv, "--root-manifest"),
    packedManifestPath: readFlagValue(argv, "--packed-manifest"),
    readmePath: readFlagValue(argv, "--readme")
  }
}

const printIssues = (label: string, issues: ReadonlyArray<PublishReadinessIssue>): void => {
  if (issues.length === 0) {
    return
  }

  console.error(`[publish:check] ${label}`)
  issues.forEach((issue) => {
    console.error(`- [${issue.code}] ${issue.message}`)
  })
}

const runCli = (): void => {
  const flags = parseFlags(process.argv.slice(2))
  const rootPath = flags.rootManifestPath ?? path.join(process.cwd(), ROOT_PACKAGE_JSON)
  const packedPath = flags.packedManifestPath ?? path.join(process.cwd(), PACKED_PACKAGE_JSON)
  const readmePath = flags.readmePath ?? path.join(process.cwd(), README_PATH)

  if (flags.syncPackedManifest) {
    synchronizePackedManifest(packedPath)
  }

  const rootManifest = loadManifestFromFile(rootPath)
  const packedManifest = flags.requirePackedManifest || flags.packedManifestPath !== undefined
    ? loadManifestIfPresent(packedPath)
    : undefined
  const readmeText = existsSync(readmePath)
    ? readFileSync(readmePath, "utf8")
    : undefined

  const report = publishReadinessReport({
    rootManifest,
    packedManifest,
    readmeText,
    options: {
      requirePackedManifest: flags.requirePackedManifest,
      enforceMonorepoTopology: flags.enforceMonorepoTopology
    }
  })

  printIssues("contract failures", report.errors)

  if (report.todos.length > 0) {
    console.error("[publish:check] deferred TODOs")
    report.todos.forEach((issue) => {
      console.error(`- [${issue.code}] ${issue.message}`)
    })
  }

  if (report.errors.length > 0) {
    process.exit(1)
  }

  console.log("[publish:check] all enforced publish-readiness contracts passed")
}

if (import.meta.main) {
  runCli()
}
