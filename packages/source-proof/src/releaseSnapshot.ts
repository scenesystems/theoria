import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Schema } from "effect"

import type { ReleaseSinceSnapshot } from "./model.js"
import { packagePublicEntrypoints, PackageReleaseManifestJson } from "./packageManifest.js"
import { packagePublicExports } from "./publicSurface.js"
import { ReleaseSinceSnapshotJson, stampReleaseSinceSnapshot } from "./releaseSince.js"
import { typeScriptProgramFromConfig, type TypeScriptProjectError } from "./typescriptProject.js"

const loadPackageReleaseManifest = (
  packageRoot: string
): Effect.Effect<Schema.Schema.Type<typeof PackageReleaseManifestJson>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const manifestJson = yield* fileSystem.readFileString(path.join(packageRoot, "package.json")).pipe(Effect.orDie)

    return yield* Schema.decodeUnknown(PackageReleaseManifestJson)(manifestJson).pipe(Effect.orDie)
  })

/**
 * Loads checked-in release snapshots from one package snapshot directory.
 *
 * Missing directories are treated as "no release history yet", which keeps the
 * initial bootstrap path mechanical for newly-governed packages.
 *
 * @since 0.0.0
 * @category queries
 */
export const loadReleaseSinceSnapshotsFromDirectory = (
  snapshotsDirectory: string
): Effect.Effect<ReadonlyArray<ReleaseSinceSnapshot>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const exists = yield* fileSystem.exists(snapshotsDirectory).pipe(Effect.orDie)

    if (!exists) {
      return []
    }

    const snapshotFiles = Arr.fromIterable(
      yield* fileSystem.readDirectory(snapshotsDirectory).pipe(Effect.orDie)
    ).sort()

    return yield* Effect.forEach(
      snapshotFiles,
      (snapshotFile) =>
        fileSystem.readFileString(path.join(snapshotsDirectory, snapshotFile)).pipe(
          Effect.orDie,
          Effect.flatMap((content) => Schema.decodeUnknown(ReleaseSinceSnapshotJson)(content).pipe(Effect.orDie))
        )
    )
  })

/**
 * Stamps the current package release snapshot from package manifest and checker truth.
 *
 * This keeps release-governance authority singular: `package.json` owns the
 * public surface and current version, the TypeScript program owns consumer
 * resolution, and checked-in snapshots preserve prior first-release history.
 *
 * @since 0.0.0
 * @category constructors
 */
export const stampCurrentPackageReleaseSinceSnapshot = (input: {
  readonly packageRoot: string
  readonly snapshotsDirectory?: string
  readonly tsconfigPath?: string
}): Effect.Effect<ReleaseSinceSnapshot, TypeScriptProjectError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const manifest = yield* loadPackageReleaseManifest(input.packageRoot)
    const entrypoints = yield* packagePublicEntrypoints(input.packageRoot, manifest)
    const snapshotsDirectory = input.snapshotsDirectory
      ?? path.join(input.packageRoot, "test/package/release-snapshots")
    const tsconfigPath = input.tsconfigPath ?? path.join(input.packageRoot, "tsconfig.src.json")
    const previousSnapshots = yield* loadReleaseSinceSnapshotsFromDirectory(snapshotsDirectory)
    const program = yield* typeScriptProgramFromConfig(tsconfigPath)

    return stampReleaseSinceSnapshot({
      packageName: manifest.name,
      releasedVersion: manifest.version,
      exports: packagePublicExports(program, entrypoints),
      previousSnapshots
    })
  })

/**
 * Renders a checked-in release snapshot as stable JSON with a trailing newline.
 *
 * @since 0.0.0
 * @category renderers
 */
export const renderReleaseSinceSnapshotJson = (
  snapshot: ReleaseSinceSnapshot
): Effect.Effect<string> =>
  Schema.encode(ReleaseSinceSnapshotJson)(snapshot).pipe(
    Effect.orDie,
    Effect.map((encoded) => `${encoded}\n`)
  )
