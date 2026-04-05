import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Schema } from "effect"

import { resolveReleaseGovernedVersion } from "./changesets.js"
import type { PackageName, ReleaseVersion } from "./identifiers.js"
import type { ReleaseSinceGovernanceFinding, ReleaseSinceSnapshot } from "./model.js"
import { packagePublicEntrypoints, PackageReleaseManifestJson } from "./packageManifest.js"
import { resolveRootFrom } from "./projectPath.js"
import { packagePublicExports } from "./publicSurface.js"
import { ReleaseSinceSnapshotJson, stampReleaseSinceSnapshot, verifyReleaseSince } from "./releaseSince.js"
import { typeScriptProgramFromConfig, type TypeScriptProjectError } from "./typescriptProject.js"

const loadReleaseSinceSnapshotFile = (
  snapshotFile: string
): Effect.Effect<ReleaseSinceSnapshot, never, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const content = yield* fileSystem.readFileString(snapshotFile).pipe(Effect.orDie)

    return yield* Schema.decodeUnknown(ReleaseSinceSnapshotJson)(content).pipe(Effect.orDie)
  })

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
    const path = yield* Path.Path
    const fileSystem = yield* FileSystem.FileSystem
    const exists = yield* fileSystem.exists(snapshotsDirectory).pipe(Effect.orDie)

    if (!exists) {
      return []
    }

    const snapshotFiles = Arr.fromIterable(
      yield* fileSystem.readDirectory(snapshotsDirectory).pipe(Effect.orDie)
    ).sort()

    return yield* Effect.forEach(
      snapshotFiles,
      (snapshotFile) => loadReleaseSinceSnapshotFile(path.join(snapshotsDirectory, snapshotFile))
    )
  })

/**
 * Loads the checked-in release snapshot for one released package version.
 *
 * This makes the current-version snapshot a mechanical contract: package tests
 * can require `${releasedVersion}.json` to exist and decode cleanly before any
 * `@since` comparisons run.
 *
 * @since 0.0.0
 * @category queries
 */
export const loadReleaseSinceSnapshotForVersion = (input: {
  readonly snapshotsDirectory: string
  readonly releasedVersion: ReleaseVersion
}): Effect.Effect<ReleaseSinceSnapshot, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path

    return yield* loadReleaseSinceSnapshotFile(path.join(input.snapshotsDirectory, `${input.releasedVersion}.json`))
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
  readonly releasedVersion?: ReleaseVersion
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
      releasedVersion: input.releasedVersion ?? manifest.version,
      exports: packagePublicExports(program, entrypoints),
      previousSnapshots
    })
  })

/**
 * Verifies release-accurate `@since` and `@category` metadata for one package root.
 *
 * This is the package-agnostic harness used by package governance suites: it
 * resolves the release-governed version from pending changesets, loads the
 * checked-in snapshot for that governed version, and compares the current
 * public surface against the full snapshot history.
 *
 * @since 0.0.0
 * @category queries
 */
export const verifyPackageReleaseSinceGovernance = (input: {
  readonly packageRootUrl: URL
  readonly snapshotsDirectory?: string
  readonly tsconfigPath?: string
  readonly workspaceRoot?: string
}): Effect.Effect<
  {
    readonly currentSnapshot: ReleaseSinceSnapshot
    readonly findings: ReadonlyArray<ReleaseSinceGovernanceFinding>
    readonly packageName: PackageName
    readonly releaseVersion: ReleaseVersion
  },
  TypeScriptProjectError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const packageRoot = yield* resolveRootFrom(input.packageRootUrl)
    const manifest = yield* loadPackageReleaseManifest(packageRoot)
    const workspaceRoot = input.workspaceRoot ?? path.dirname(path.dirname(packageRoot))
    const releaseVersion = yield* resolveReleaseGovernedVersion({
      workspaceRoot,
      packageName: manifest.name,
      currentVersion: manifest.version
    })
    const snapshotsDirectory = input.snapshotsDirectory
      ?? path.join(packageRoot, "test/package/release-snapshots")
    const tsconfigPath = input.tsconfigPath ?? path.join(packageRoot, "tsconfig.src.json")
    const entrypoints = yield* packagePublicEntrypoints(packageRoot, manifest)
    const program = yield* typeScriptProgramFromConfig(tsconfigPath)
    const snapshots = yield* loadReleaseSinceSnapshotsFromDirectory(snapshotsDirectory)
    const currentSnapshot = yield* loadReleaseSinceSnapshotForVersion({
      snapshotsDirectory,
      releasedVersion: releaseVersion
    })

    return {
      currentSnapshot,
      findings: verifyReleaseSince({
        currentVersion: releaseVersion,
        exports: packagePublicExports(program, entrypoints),
        snapshots
      }),
      packageName: manifest.name,
      releaseVersion
    }
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
