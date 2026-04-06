import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { TheoriaReleaseFrameworkAuthority } from "../../packages/source-proof/src/index.js"

const RootManifestJson = Schema.parseJson(
  Schema.Struct({
    scripts: Schema.Record({
      key: Schema.String,
      value: Schema.String
    })
  })
)

describe("release framework repository contract", () => {
  it.effect("declares one canonical root-owned release framework covering root gates, packed artifacts, docs, snapshots, and changesets", () =>
    Effect.sync(() => {
      expect(TheoriaReleaseFrameworkAuthority.name).toBe("root-release-framework")
      expect(TheoriaReleaseFrameworkAuthority.packageAlignmentSeam).toBe("publishReadinessProfiles")
      expect(TheoriaReleaseFrameworkAuthority.rootGates).toEqual([
        "check",
        "check:tests",
        "lint",
        "test",
        "build",
        "docgen"
      ])
      expect(TheoriaReleaseFrameworkAuthority.packedArtifactContract).toBe("build-utils pack-v3")
      expect(TheoriaReleaseFrameworkAuthority.docsContract).toEqual([
        "README release checklist",
        "root docgen",
        "package proof commands"
      ])
      expect(TheoriaReleaseFrameworkAuthority.releaseSnapshotContract).toEqual([
        "checked-in test/package/release-snapshots/*.json",
        "version-stamped @since/@category governance",
        "root snapshot-stamping CLI"
      ])
      expect(TheoriaReleaseFrameworkAuthority.changesetWorkflow).toEqual([
        "changeset",
        "changeset:version",
        "changeset:publish",
        "scripts/changeset-version-with-release-snapshots.mjs"
      ])
      expect(TheoriaReleaseFrameworkAuthority.publishReadinessCli).toBe("scripts/publish-readiness.ts")
      expect(TheoriaReleaseFrameworkAuthority.releaseSnapshotCli).toBe("scripts/stamp-release-snapshot.ts")
      expect(TheoriaReleaseFrameworkAuthority.governedPackages.map((profile) => profile.packageName)).toEqual([
        "effect-math",
        "effect-search",
        "effect-dsp",
        "effect-text",
        "effect-inference",
        "@scenesystems/digest",
        "@scenesystems/seal",
        "@scenesystems/sign"
      ])
    }))

  it.effect("keeps the root manifest and repository-owned release scripts wired to that authority", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const rootPath = process.cwd()
      const manifestJson = yield* fileSystem.readFileString(path.join(rootPath, "package.json")).pipe(Effect.orDie)
      const manifest = yield* Schema.decodeUnknown(RootManifestJson)(manifestJson).pipe(Effect.orDie)
      const scriptExistence = yield* Effect.all(
        {
          publishReadinessCli: fileSystem.exists(
            path.join(rootPath, TheoriaReleaseFrameworkAuthority.publishReadinessCli)
          ).pipe(Effect.orDie),
          releaseSnapshotCli: fileSystem.exists(
            path.join(rootPath, TheoriaReleaseFrameworkAuthority.releaseSnapshotCli)
          ).pipe(Effect.orDie),
          changesetVersionCli: fileSystem.exists(
            path.join(rootPath, "scripts/changeset-version-with-release-snapshots.mjs")
          ).pipe(Effect.orDie)
        },
        { concurrency: "unbounded" }
      )

      expect(scriptExistence).toEqual({
        publishReadinessCli: true,
        releaseSnapshotCli: true,
        changesetVersionCli: true
      })
      expect(manifest.scripts.check).toBe("tsc -b tsconfig.json")
      expect(manifest.scripts["check:tests"]).toBe("tsc -b tsconfig.test.json")
      expect(manifest.scripts.lint).toBe("eslint --max-warnings=0")
      expect(manifest.scripts.test).toBe("vitest run")
      expect(manifest.scripts.build).toBe(
        "tsc -b tsconfig.build.json && bun run --filter '*' build && bun run scripts/resolve-workspace-deps.ts"
      )
      expect(manifest.scripts.docgen).toBe("bun run --filter '*' docgen")
      expect(manifest.scripts.changeset).toBe("changeset")
      expect(manifest.scripts["changeset:version"]).toBe("node scripts/changeset-version-with-release-snapshots.mjs")
      expect(manifest.scripts["changeset:publish"]).toBe("changeset publish")
    }).pipe(Effect.provide(BunContext.layer)))
})
