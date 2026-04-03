/**
 * resolve-workspace-deps.ts
 *
 * Resolves `workspace:` protocol references in packed package manifests to real
 * semver ranges after `build-utils pack-v3`.
 */

import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

class WorkspaceDependencyResolutionError {
  readonly _tag = "WorkspaceDependencyResolutionError"

  constructor(readonly message: string) {}
}

const rootUrl = new URL("../", import.meta.url)
const checkMode = process.argv.includes("--check")

const parseManifest = (content: string): Record<string, unknown> => {
  const parsed = JSON.parse(content)
  return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {}
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined

const asString = (value: unknown): string | undefined =>
  typeof value === "string"
    ? value
    : undefined

const resolveProjectPaths = Effect.gen(function*() {
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(rootUrl).pipe(Effect.orDie)

  return {
    root,
    packagesDir: path.join(root, "packages")
  }
})

const listPackageDirectories = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { packagesDir } = yield* resolveProjectPaths
  const entries = yield* fs.readDirectory(packagesDir).pipe(Effect.orDie)
  const directoryEntries = yield* Effect.forEach(entries, (entry) =>
    fs.stat(path.join(packagesDir, entry)).pipe(
      Effect.orDie,
      Effect.map((stat) =>
        stat.type === "Directory"
          ? entry
          : undefined
      )
    ),
    { concurrency: "unbounded" }
  )

  return directoryEntries.filter((entry): entry is string => entry !== undefined)
})

const buildVersionMap = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { packagesDir } = yield* resolveProjectPaths
  const entries = yield* listPackageDirectories
  const versions = new Map<string, string>()

  yield* Effect.forEach(
    entries,
    (entry) =>
      Effect.gen(function*() {
        const packageJsonPath = path.join(packagesDir, entry, "package.json")
        const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orDie)

        if (!exists) {
          return
        }

        const manifest = parseManifest(yield* fs.readFileString(packageJsonPath).pipe(Effect.orDie))
        const name = asString(manifest.name)
        const version = asString(manifest.version)

        if (name !== undefined && version !== undefined) {
          versions.set(name, version)
        }
      }),
    { concurrency: "unbounded", discard: true }
  )

  return versions
})

const resolveSpec = (spec: string, dependencyName: string, versions: Map<string, string>): Effect.Effect<string> =>
  Effect.gen(function*() {
    if (!spec.startsWith("workspace:")) {
      return spec
    }

    const version = versions.get(dependencyName)

    if (version === undefined) {
      return yield* Effect.fail(
        new WorkspaceDependencyResolutionError(
          `Cannot resolve workspace dependency "${dependencyName}": not found in packages/.`
        )
      )
    }

    const protocol = spec.slice("workspace:".length)

    if (protocol === "^") {
      return `^${version}`
    }

    if (protocol === "~") {
      return `~${version}`
    }

    if (protocol === "*") {
      return `^${version}`
    }

    return yield* Effect.fail(
      new WorkspaceDependencyResolutionError(
        `Unsupported workspace protocol "${spec}" for "${dependencyName}".`
      )
    )
  })

const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const

const processPackage = (packageDirectory: string, versions: Map<string, string>) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const distPackageJsonPath = path.join(packageDirectory, "dist", "package.json")
    const exists = yield* fs.exists(distPackageJsonPath).pipe(Effect.orDie)

    if (!exists) {
      return { name: packageDirectory, resolved: 0, errors: [] as Array<string> }
    }

    const manifest = parseManifest(yield* fs.readFileString(distPackageJsonPath).pipe(Effect.orDie))
    const errors: Array<string> = []
    let resolved = 0

    yield* Effect.forEach(
      dependencyFields,
      (field) =>
        Effect.gen(function*() {
          const fieldRecord = asRecord(manifest[field])

          if (fieldRecord === undefined) {
            return
          }

          yield* Effect.forEach(
            Object.entries(fieldRecord),
            ([dependencyName, dependencySpec]) =>
              Effect.gen(function*() {
                if (typeof dependencySpec !== "string" || !dependencySpec.startsWith("workspace:")) {
                  return
                }

                if (checkMode) {
                  errors.push(`${String(manifest.name ?? packageDirectory)} ${field}.${dependencyName}: ${dependencySpec}`)
                  return
                }

                const resolvedSpec = yield* resolveSpec(dependencySpec, dependencyName, versions).pipe(
                  Effect.catchAll((error) => {
                    errors.push(error.message)
                    return Effect.succeed(dependencySpec)
                  })
                )

                if (resolvedSpec !== dependencySpec) {
                  fieldRecord[dependencyName] = resolvedSpec
                  resolved += 1
                }
              }),
            { concurrency: "unbounded", discard: true }
          )
        }),
      { concurrency: "unbounded", discard: true }
    )

    if (!checkMode && resolved > 0) {
      yield* fs.writeFileString(distPackageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`).pipe(Effect.orDie)
    }

    return {
      name: asString(manifest.name) ?? packageDirectory,
      resolved,
      errors
    }
  })

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { packagesDir } = yield* resolveProjectPaths
  const versions = yield* buildVersionMap
  const entries = yield* listPackageDirectories
  const results = yield* Effect.forEach(entries, (entry) => processPackage(path.join(packagesDir, entry), versions), {
    concurrency: "unbounded"
  })

  const totalResolved = results.reduce((sum, result) => sum + result.resolved, 0)
  const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0)

  yield* Effect.forEach(
    results,
    (result) =>
      Effect.gen(function*() {
        yield* Effect.forEach(result.errors, (error) => Console.error(`  ✗ ${error}`), { discard: true })

        if (result.resolved > 0) {
          yield* Console.log(`  ✓ ${result.name}: resolved ${result.resolved} workspace dep(s)`)
        }
      }),
    { discard: true }
  )

  if (checkMode && totalErrors > 0) {
    yield* Console.error(`\n✗ Found ${totalErrors} unresolved workspace: reference(s) in dist/`)
    return yield* Effect.fail(new WorkspaceDependencyResolutionError("workspace dependency check failed"))
  }

  if (!checkMode && totalErrors > 0) {
    yield* Console.error(`\n✗ ${totalErrors} error(s) resolving workspace deps`)
    return yield* Effect.fail(new WorkspaceDependencyResolutionError("workspace dependency resolution failed"))
  }

  yield* Console.log(
    checkMode
      ? "✓ No workspace: references in dist/"
      : `\n✓ Resolved ${totalResolved} workspace dep(s) across all packages`
  )
})

const main = program.pipe(
  Effect.catchAll(() => Effect.sync(() => process.exit(1))),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
