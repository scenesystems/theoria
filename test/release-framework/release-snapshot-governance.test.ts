import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { loadPublishReadinessManifest, TheoriaReleaseFrameworkAuthority } from "../../packages/source-proof/src/index.js"

describe("release snapshot governance", () => {
  it.effect("keeps package-local snapshots governed by root CLI wiring across the shipped suite", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fileSystem = yield* FileSystem.FileSystem
      const scripts = yield* Effect.forEach(
        TheoriaReleaseFrameworkAuthority.governedPackages,
        (profile) =>
          Effect.gen(function*() {
            const packageRoot = path.join(process.cwd(), profile.packageDirectory)
            const manifest = yield* loadPublishReadinessManifest(path.join(packageRoot, "package.json"))
            const releaseSnapshotsDirectory = path.join(packageRoot, "test/package/release-snapshots")
            const snapshotsDirectoryExists = yield* fileSystem.exists(releaseSnapshotsDirectory).pipe(Effect.orDie)
            const scripts = Option.fromNullable(manifest.scripts)

            expect(snapshotsDirectoryExists).toBe(true)
            expect(Option.isSome(scripts)).toBe(true)

            if (Option.isNone(scripts)) {
              return null
            }

            return {
              packageName: profile.packageName,
              command: scripts.value["release-snapshots:stamp"]
            }
          }),
        { concurrency: "unbounded" }
      )

      expect(scripts).toEqual([
        {
          packageName: "effect-math",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        },
        {
          packageName: "effect-search",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        },
        {
          packageName: "effect-dsp",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        },
        {
          packageName: "effect-text",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        },
        {
          packageName: "effect-inference",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        },
        {
          packageName: "@scenesystems/digest",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        },
        {
          packageName: "@scenesystems/seal",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        },
        {
          packageName: "@scenesystems/sign",
          command: "bun ../../scripts/stamp-release-snapshot.ts"
        }
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
