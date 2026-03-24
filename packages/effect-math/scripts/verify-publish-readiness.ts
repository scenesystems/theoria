/**
 * Publication readiness verification for effect-math.
 *
 * Validates package.json fields, subpath exports, internal blocks,
 * README, keywords, and repository metadata before publish.
 *
 * Usage: bun run publish:check
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Schema } from "effect"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ["name", "version", "description", "license", "exports", "scripts"] as const

const REQUIRED_KEYWORDS = [
  "effect",
  "numerics",
  "linear-algebra",
  "statistics",
  "probability",
  "mathematics"
] as const

const REQUIRED_SUBPATH_EXPORTS: Record<string, string | null> = {
  ".": "./src/index.ts",
  "./contracts": "./src/contracts/index.ts",
  "./experimental": "./src/experimental/index.ts",
  "./Numeric": "./src/Numeric/index.ts",
  "./Algebra": "./src/Algebra/index.ts",
  "./LinearAlgebra": "./src/LinearAlgebra/index.ts",
  "./Calculus": "./src/Calculus/index.ts",
  "./Special": "./src/Special/index.ts",
  "./Probability": "./src/Probability/index.ts",
  "./Statistics": "./src/Statistics/index.ts",
  "./Optimization": "./src/Optimization/index.ts",
  "./Geometry": "./src/Geometry/index.ts"
}

const REQUIRED_INTERNAL_BLOCKS: ReadonlyArray<string> = [
  "./internal/*",
  "./Numeric/internal/*",
  "./Algebra/internal/*",
  "./LinearAlgebra/internal/*",
  "./Calculus/internal/*",
  "./Special/internal/*",
  "./Probability/internal/*",
  "./Statistics/internal/*",
  "./Optimization/internal/*",
  "./Geometry/internal/*"
]

const FORBIDDEN_REPOSITORY_FRAGMENTS = [
  "github.com/scenesystems/eva",
  "github.com/scenesystems/eva.git"
]

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RepositorySchema = Schema.Struct({
  type: Schema.String,
  url: Schema.String,
  directory: Schema.String
})

const PackageJsonSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.String,
  license: Schema.String,
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  scripts: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  keywords: Schema.optional(Schema.Array(Schema.String)),
  repository: Schema.optional(RepositorySchema),
  homepage: Schema.optional(Schema.String)
})

// ---------------------------------------------------------------------------
// Issue tracking
// ---------------------------------------------------------------------------

type Issue = { readonly code: string; readonly message: string }

const issue = (code: string, message: string): Issue => ({ code, message })

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const checkRequiredFields = (
  manifest: typeof PackageJsonSchema.Type
): ReadonlyArray<Issue> =>
  REQUIRED_FIELDS.flatMap((field) =>
    (manifest as Record<string, unknown>)[field] === undefined
      ? [issue(`field.missing.${field}`, `package.json is missing required field: ${field}`)]
      : []
  )

const checkSubpathExports = (
  exports: Record<string, unknown>,
  rootDir: string,
  fs: FileSystem.FileSystem
): Effect.Effect<ReadonlyArray<Issue>> =>
  Effect.gen(function*() {
    const issues: Array<Issue> = []

    for (const [subpath, expectedTarget] of Object.entries(REQUIRED_SUBPATH_EXPORTS)) {
      if (!(subpath in exports)) {
        issues.push(issue("exports.missing", `Missing required export subpath: ${subpath}`))
        continue
      }

      const actual = exports[subpath]
      if (actual !== expectedTarget) {
        issues.push(
          issue(
            "exports.target-mismatch",
            `${subpath}: expected ${String(expectedTarget)} but found ${String(actual)}`
          )
        )
        continue
      }

      if (typeof expectedTarget === "string") {
        const filePath = `${rootDir}/${expectedTarget}`
        const exists = yield* fs.exists(filePath)
        if (!exists) {
          issues.push(
            issue("exports.file-missing", `Export ${subpath} points to ${expectedTarget} which does not exist`)
          )
        }
      }
    }

    return issues
  })

const checkInternalBlocks = (
  exports: Record<string, unknown>
): ReadonlyArray<Issue> =>
  REQUIRED_INTERNAL_BLOCKS.flatMap((block) => {
    if (!(block in exports)) {
      return [issue("internal.missing", `Missing internal block: ${block}`)]
    }
    if (exports[block] !== null) {
      return [issue("internal.not-null", `Internal block ${block} must be null, found: ${String(exports[block])}`)]
    }
    return []
  })

const checkReadme = (
  rootDir: string,
  fs: FileSystem.FileSystem
): Effect.Effect<ReadonlyArray<Issue>> =>
  Effect.gen(function*() {
    const readmePath = `${rootDir}/README.md`
    const exists = yield* fs.exists(readmePath)
    if (!exists) {
      return [issue("readme.missing", "README.md does not exist")]
    }
    const content = yield* fs.readFileString(readmePath, "utf8")
    if (content.trim().length === 0) {
      return [issue("readme.empty", "README.md exists but is empty")]
    }
    return []
  })

const checkKeywords = (
  keywords: ReadonlyArray<string> | undefined
): ReadonlyArray<Issue> => {
  if (keywords === undefined) {
    return [issue("keywords.missing", "package.json is missing keywords array")]
  }
  const keywordSet = new Set(keywords)
  return REQUIRED_KEYWORDS.flatMap((kw) =>
    keywordSet.has(kw)
      ? []
      : [issue("keywords.missing-keyword", `Missing required keyword: ${kw}`)]
  )
}

const checkRepository = (
  manifest: typeof PackageJsonSchema.Type
): ReadonlyArray<Issue> => {
  const issues: Array<Issue> = []

  if (manifest.repository === undefined) {
    issues.push(issue("repository.missing", "package.json is missing repository field"))
    return issues
  }

  const url = manifest.repository.url
  for (const fragment of FORBIDDEN_REPOSITORY_FRAGMENTS) {
    if (url.includes(fragment)) {
      issues.push(
        issue(
          "repository.forbidden-url",
          `Repository URL must not point to eva: ${url}`
        )
      )
    }
  }

  if (!url.includes("theoria")) {
    issues.push(
      issue("repository.not-theoria", `Repository URL must point to theoria, found: ${url}`)
    )
  }

  return issues
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const rootDir = process.cwd()
  const packageJsonPath = path.join(rootDir, "package.json")

  yield* Console.log("[publish:check] verifying publication readiness for effect-math…")

  const raw = yield* fs.readFileString(packageJsonPath, "utf8")
  const json = JSON.parse(raw)

  const decoded = yield* Schema.decodeUnknown(PackageJsonSchema)(json).pipe(
    Effect.mapError((e) => ({
      _tag: "SchemaError" as const,
      message: `package.json schema validation failed: ${String(e)}`
    }))
  )

  const exports = decoded.exports as Record<string, unknown>

  const fieldIssues = checkRequiredFields(decoded)
  const exportIssues = yield* checkSubpathExports(exports, rootDir, fs)
  const internalIssues = checkInternalBlocks(exports)
  const readmeIssues = yield* checkReadme(rootDir, fs)
  const keywordIssues = checkKeywords(decoded.keywords)
  const repoIssues = checkRepository(decoded)

  const allIssues = Arr.flatten([
    fieldIssues,
    exportIssues,
    internalIssues,
    readmeIssues,
    keywordIssues,
    repoIssues
  ])

  if (allIssues.length > 0) {
    yield* Console.error("[publish:check] ❌ contract failures:")
    yield* Effect.forEach(allIssues, (i) =>
      Console.error(`  - [${i.code}] ${i.message}`)
    )
    yield* Console.error(`\n[publish:check] ${String(allIssues.length)} issue(s) found`)
    return yield* Effect.fail({ _tag: "ReadinessFailure" as const, count: allIssues.length })
  }

  yield* Console.log("[publish:check] ✅ all publish-readiness contracts passed")
}).pipe(
  Effect.catchAll((err) =>
    Console.error(`[publish:check] FATAL: ${String(err.message ?? JSON.stringify(err))}`).pipe(
      Effect.flatMap(() => Effect.sync(() => process.exit(1)))
    )
  ),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(program)
