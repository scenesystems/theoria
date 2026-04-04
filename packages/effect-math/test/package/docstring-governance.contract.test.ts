import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"

import {
  loadReleaseSinceSnapshotForVersion,
  packagePublicEntrypoints,
  packagePublicExports,
  PackageReleaseManifestJson,
  ReleaseSinceSnapshotJson,
  resolveReleaseGovernedVersion,
  resolveRootFrom,
  typeScriptProgramFromConfig,
  verifyReleaseSince
} from "../../../source-proof/src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const loadReleaseSinceSnapshots = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* resolveRootFrom(packageRootUrl)
  const snapshotsDirectory = path.join(root, "test/package/release-snapshots")
  const snapshotFiles = Arr.fromIterable(yield* fileSystem.readDirectory(snapshotsDirectory).pipe(Effect.orDie)).sort()

  return yield* Effect.forEach(
    snapshotFiles,
    (snapshotFile) =>
      fileSystem.readFileString(path.join(snapshotsDirectory, snapshotFile)).pipe(
        Effect.orDie,
        Effect.flatMap((content) => Schema.decodeUnknown(ReleaseSinceSnapshotJson)(content).pipe(Effect.orDie))
      )
  )
})

describe("package docstring governance", () => {
  it.effect("keeps public export @since tags release-accurate across the package surface", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const manifestJson = yield* fileSystem.readFileString(path.join(root, "package.json")).pipe(Effect.orDie)
      const manifest = yield* Schema.decodeUnknown(PackageReleaseManifestJson)(manifestJson).pipe(Effect.orDie)
      const releaseVersion = yield* resolveReleaseGovernedVersion({
        workspaceRoot: path.dirname(path.dirname(root)),
        packageName: manifest.name,
        currentVersion: manifest.version
      })
      const snapshotsDirectory = path.join(root, "test/package/release-snapshots")
      const entrypoints = yield* packagePublicEntrypoints(root, manifest)
      const program = yield* typeScriptProgramFromConfig(path.join(root, "tsconfig.src.json")).pipe(Effect.orDie)
      const currentSnapshot = yield* loadReleaseSinceSnapshotForVersion({
        snapshotsDirectory,
        releasedVersion: releaseVersion
      })
      const snapshots = yield* loadReleaseSinceSnapshots

      expect(currentSnapshot.packageName).toBe(manifest.name)
      expect(currentSnapshot.releasedVersion).toBe(releaseVersion)

      expect(
        verifyReleaseSince({
          currentVersion: releaseVersion,
          exports: packagePublicExports(program, entrypoints),
          snapshots
        })
      ).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
