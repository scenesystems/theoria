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

const restoreNullExportBarriers = (
  rootManifest: Record<string, unknown>,
  packedManifest: Record<string, unknown>
): {
  readonly exports: Record<string, unknown> | undefined
  readonly restoredCount: number
} => {
  const rootExports = asRecord(rootManifest.exports)
  const packedExports = asRecord(packedManifest.exports)

  if (rootExports === undefined || packedExports === undefined) {
    return {
      exports: packedExports,
      restoredCount: 0
    }
  }

  const nullExportEntries = Object.entries(rootExports).filter(([, target]) => target === null)
  const restoredCount = nullExportEntries.reduce(
    (count, [subpath]) => (packedExports[subpath] === null ? count : count + 1),
    0
  )

  return {
    exports: nullExportEntries.reduce<Record<string, unknown>>(
      (currentExports, [subpath, target]) => ({ ...currentExports, [subpath]: target }),
      packedExports
    ),
    restoredCount
  }
}

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
  const discoveredPackages = yield* Effect.forEach(
    entries,
    (entry) =>
      Effect.gen(function*() {
        const packageJsonPath = path.join(packagesDir, entry, "package.json")
        const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orDie)

        if (!exists) {
          return undefined
        }

        const manifest = parseManifest(yield* fs.readFileString(packageJsonPath).pipe(Effect.orDie))
        const name = asString(manifest.name)
        const version = asString(manifest.version)

        if (name !== undefined && version !== undefined) {
          return [name, version] as const
        }

        return undefined
      }),
    { concurrency: "unbounded" }
  )

  return new Map(discoveredPackages.filter((entry): entry is readonly [string, string] => entry !== undefined))
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

const resolveDependencyField = (
  packageName: string,
  field: (typeof dependencyFields)[number],
  fieldRecord: Record<string, unknown>,
  versions: Map<string, string>
) =>
  Effect.gen(function*() {
    const results = yield* Effect.forEach(
      Object.entries(fieldRecord),
      ([dependencyName, dependencySpec]) =>
        Effect.gen(function*() {
          if (typeof dependencySpec !== "string" || !dependencySpec.startsWith("workspace:")) {
            return {
              error: undefined,
              resolvedEntry: undefined,
              resolvedCount: 0
            }
          }

          if (checkMode) {
            return {
              error: `${packageName} ${field}.${dependencyName}: ${dependencySpec}`,
              resolvedEntry: undefined,
              resolvedCount: 0
            }
          }

          const resolution = yield* resolveSpec(dependencySpec, dependencyName, versions).pipe(
            Effect.either
          )

          if (resolution._tag === "Left") {
            return {
              error: resolution.left.message,
              resolvedEntry: undefined,
              resolvedCount: 0
            }
          }

          return {
            error: undefined,
            resolvedEntry:
              resolution.right === dependencySpec
                ? undefined
                : ([dependencyName, resolution.right] as const),
            resolvedCount: resolution.right === dependencySpec ? 0 : 1
          }
        }),
      { concurrency: "unbounded" }
    )

    return {
      errors: results.flatMap((result) => (result.error === undefined ? [] : [result.error])),
      resolvedCount: results.reduce((sum, result) => sum + result.resolvedCount, 0),
      updates: Object.fromEntries(
        results.flatMap((result) => (result.resolvedEntry === undefined ? [] : [result.resolvedEntry]))
      )
    }
  })

const processPackage = (packageDirectory: string, versions: Map<string, string>) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const rootPackageJsonPath = path.join(packageDirectory, "package.json")
    const distPackageJsonPath = path.join(packageDirectory, "dist", "package.json")
    const exists = yield* fs.exists(distPackageJsonPath).pipe(Effect.orDie)

    if (!exists) {
      return {
        name: packageDirectory,
        resolved: 0,
        restoredExportBarriers: 0,
        errors: [] as Array<string>
      }
    }

    const rootManifest = parseManifest(yield* fs.readFileString(rootPackageJsonPath).pipe(Effect.orDie))
    const manifest = parseManifest(yield* fs.readFileString(distPackageJsonPath).pipe(Effect.orDie))
    const packageName = asString(manifest.name) ?? packageDirectory
    const fieldResults = yield* Effect.forEach(
      dependencyFields,
      (field) =>
        Effect.gen(function*() {
          const fieldRecord = asRecord(manifest[field])

          if (fieldRecord === undefined) {
            return {
              field,
              nextFieldRecord: undefined,
              errors: [] as Array<string>,
              resolvedCount: 0
            }
          }

          const result = yield* resolveDependencyField(packageName, field, fieldRecord, versions)

          return {
            field,
            nextFieldRecord: { ...fieldRecord, ...result.updates },
            errors: result.errors,
            resolvedCount: result.resolvedCount
          }
        }),
      { concurrency: "unbounded" }
    )

    const nextManifest = fieldResults.reduce<Record<string, unknown>>(
      (currentManifest, result) =>
        result.nextFieldRecord === undefined
          ? currentManifest
          : { ...currentManifest, [result.field]: result.nextFieldRecord },
      manifest
    )
    const exportBarrierRepair = restoreNullExportBarriers(rootManifest, nextManifest)
    const nextManifestWithExports = exportBarrierRepair.exports === undefined
      ? nextManifest
      : { ...nextManifest, exports: exportBarrierRepair.exports }
    const errors = fieldResults.flatMap((result) => result.errors)
    const resolved = fieldResults.reduce((sum, result) => sum + result.resolvedCount, 0)

    if (!checkMode && (resolved > 0 || exportBarrierRepair.restoredCount > 0)) {
      yield* fs.writeFileString(distPackageJsonPath, `${JSON.stringify(nextManifestWithExports, null, 2)}\n`).pipe(
        Effect.orDie
      )
    }

    return {
      name: packageName,
      resolved,
      restoredExportBarriers: exportBarrierRepair.restoredCount,
      errors
    }
  })

const program = Effect.gen(function*() {
  const path = yield* Path.Path
  const { packagesDir } = yield* resolveProjectPaths
  const versions = yield* buildVersionMap
  const entries = yield* listPackageDirectories
  const results = yield* Effect.forEach(entries, (entry) => processPackage(path.join(packagesDir, entry), versions), {
    concurrency: "unbounded"
  })

  const totalResolved = results.reduce((sum, result) => sum + result.resolved, 0)
  const totalRestoredExportBarriers = results.reduce((sum, result) => sum + result.restoredExportBarriers, 0)
  const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0)

  yield* Effect.forEach(
    results,
    (result) =>
      Effect.gen(function*() {
        yield* Effect.forEach(result.errors, (error) => Console.error(`  ✗ ${error}`), { discard: true })

        if (result.resolved > 0) {
          yield* Console.log(`  ✓ ${result.name}: resolved ${result.resolved} workspace dep(s)`)
        }

        if (result.restoredExportBarriers > 0) {
          yield* Console.log(
            `  ✓ ${result.name}: restored ${result.restoredExportBarriers} packed export barrier${result.restoredExportBarriers === 1 ? "" : "s"}`
          )
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
      : `\n✓ Resolved ${totalResolved} workspace dep(s) and restored ${totalRestoredExportBarriers} packed export barrier${
        totalRestoredExportBarriers === 1 ? "" : "s"
      } across all packages`
  )
})

const main = program.pipe(
  Effect.catchAll(() => Effect.sync(() => process.exit(1))),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
