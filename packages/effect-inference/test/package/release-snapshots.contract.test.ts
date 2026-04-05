import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  loadReleaseSinceSnapshotForVersion,
  PackageReleaseManifestJson,
  resolveReleaseGovernedVersion,
  resolveRootFrom
} from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/release-snapshots", () => {
  it.effect("captures the versioned public surface for v0.1", () =>
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
      const snapshot = yield* loadReleaseSinceSnapshotForVersion({
        snapshotsDirectory: path.join(root, "test/package/release-snapshots"),
        releasedVersion: releaseVersion
      })

      expect(snapshot.packageName).toBe("effect-inference")
      expect(snapshot.releasedVersion).toBe(releaseVersion)
      expect(snapshot.exports.map((entry) => entry.subpath)).toEqual(
        expect.arrayContaining([
          ".",
          "./Contracts",
          "./Errors",
          "./OpenAiCompatible",
          "./HuggingFace",
          "./Runtime",
          "./Testing",
          "./experimental"
        ])
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
