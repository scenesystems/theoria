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
  it.effect("captures the versioned public surface for detached signatures, batch verification, and key codecs", () =>
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

      expect(snapshot.packageName).toBe("@scenesystems/sign")
      expect(snapshot.releasedVersion).toBe(releaseVersion)
      expect(snapshot.exports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ exportName: "BatchVerifySignatureRequest", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "BatchVerifyDetachedSignatureRequest", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "BatchVerifyReport", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "batchVerify", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "DetachedSignature", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "signDetached", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "verifyDetached", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "toBase64Url", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "fromBase64Url", firstReleasedIn: "0.2.0" })
        ])
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
