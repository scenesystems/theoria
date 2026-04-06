import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import {
  buildPackedManifestFixture,
  loadPublishReadinessManifest,
  loadReleaseSinceSnapshotForVersion,
  packageNameFromString,
  publishReadinessProfile,
  publishReadinessReport,
  readOptionalTextFile,
  resolveReleaseGovernedVersion,
  resolveRootFrom
} from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/release-framework-alignment", () => {
  it.effect("participates in the shared root release framework for docs, snapshots, and packed-manifest proof", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const workspaceRoot = path.dirname(path.dirname(root))
      const profile = yield* Option.match(
        publishReadinessProfile(packageNameFromString("@scenesystems/seal")),
        {
          onNone: () => Effect.die("missing @scenesystems/seal publish-readiness profile"),
          onSome: Effect.succeed
        }
      )
      const manifest = yield* loadPublishReadinessManifest(path.join(root, "package.json"))
      const readmeText = yield* readOptionalTextFile(path.join(root, "README.md")).pipe(
        Effect.map((readmeOption) => Option.getOrElse(readmeOption, () => ""))
      )
      const report = publishReadinessReport({
        profile,
        rootManifest: manifest,
        packedManifest: buildPackedManifestFixture(manifest),
        readmeText,
        requirePackedManifest: true,
        enforceMonorepoTopology: true
      })
      const releaseVersion = yield* resolveReleaseGovernedVersion({
        workspaceRoot,
        packageName: manifest.name,
        currentVersion: manifest.version
      })
      const snapshot = yield* loadReleaseSinceSnapshotForVersion({
        snapshotsDirectory: path.join(root, "test/package/release-snapshots"),
        releasedVersion: releaseVersion
      })
      const schemaDocs = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/schemas/SealedEnvelope.ts.md")
      ).pipe(Effect.orDie)
      const packageEntries = yield* fileSystem.readDirectory(root).pipe(Effect.orDie)

      expect(report.errors).toEqual([])
      expect(report.todos).toEqual([])

      expect(snapshot.packageName).toBe("@scenesystems/seal")
      expect(snapshot.releasedVersion).toBe(releaseVersion)
      expect(snapshot.exports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ exportName: "SealedEnvelope", firstReleasedIn: "0.1.0" }),
          expect.objectContaining({ exportName: "EnvelopeKeyMetadata", firstReleasedIn: "0.2.0" }),
          expect.objectContaining({ exportName: "EnvelopeKeyMetadataType", firstReleasedIn: "0.2.0" })
        ])
      )

      expect(schemaDocs).toContain("EnvelopeKeyMetadata")
      expect(schemaDocs).toContain("Added in v0.2.0")
      expect(packageEntries).not.toContain("stamp-release-snapshot.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
