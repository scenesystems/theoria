import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  loadReleaseSinceSnapshotForVersion,
  loadReleaseSinceSnapshotsFromDirectory,
  packagePublicEntrypoints,
  packagePublicExports,
  PackageReleaseManifestJson,
  resolveReleaseGovernedVersion,
  resolveRootFrom,
  typeScriptProgramFromConfig,
  verifyReleaseSince
} from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

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
      const snapshots = yield* loadReleaseSinceSnapshotsFromDirectory(snapshotsDirectory)

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
