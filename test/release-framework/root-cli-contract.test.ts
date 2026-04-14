import { Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { loadPublishReadinessManifest, TheoriaReleaseFrameworkAuthority } from "../../packages/source-proof/src/index.js"

describe("release framework root cli contract", () => {
  it.effect("keeps package manifest wiring on the root publish-readiness and release-snapshot CLIs", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const wiring = yield* Effect.forEach(
        TheoriaReleaseFrameworkAuthority.governedPackages,
        (profile) =>
          Effect.gen(function*() {
            const packageRoot = path.join(process.cwd(), profile.packageDirectory)
            const manifest = yield* loadPublishReadinessManifest(path.join(packageRoot, "package.json"))
            const scripts = Option.fromNullable(manifest.scripts)

            expect(Option.isSome(scripts)).toBe(true)

            return {
              packageName: profile.packageName,
              publishCheck: Option.getOrUndefined(Option.flatMap(scripts, (currentScripts) => Option.fromNullable(currentScripts["publish:check"]))),
              releaseSnapshotsStamp: Option.getOrUndefined(
                Option.flatMap(scripts, (currentScripts) => Option.fromNullable(currentScripts["release-snapshots:stamp"]))
              ),
              changesetPublish: Option.getOrUndefined(
                Option.flatMap(scripts, (currentScripts) => Option.fromNullable(currentScripts["changeset-publish"]))
              )
            }
          }),
        { concurrency: "unbounded" }
      )

      expect(TheoriaReleaseFrameworkAuthority.publishReadinessCli).toBe("scripts/publish-readiness.ts")
      expect(TheoriaReleaseFrameworkAuthority.releaseSnapshotCli).toBe("scripts/stamp-release-snapshot.ts")
      expect(wiring).toEqual([
        {
          packageName: "effect-math",
          publishCheck: "bun ../../scripts/publish-readiness.ts --package=effect-math",
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish: undefined
        },
        {
          packageName: "effect-search",
          publishCheck: "bun ../../scripts/publish-readiness.ts --package=effect-search",
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish:
            "bun run build && bun run publish:check -- --require-packed-manifest --enforce-monorepo-topology && bun run test && changeset publish"
        },
        {
          packageName: "effect-dsp",
          publishCheck: undefined,
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish: undefined
        },
        {
          packageName: "effect-text",
          publishCheck: undefined,
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish: undefined
        },
        {
          packageName: "effect-inference",
          publishCheck: undefined,
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish: undefined
        },
        {
          packageName: "@scenesystems/digest",
          publishCheck: undefined,
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish: undefined
        },
        {
          packageName: "@scenesystems/seal",
          publishCheck: undefined,
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish: undefined
        },
        {
          packageName: "@scenesystems/sign",
          publishCheck: undefined,
          releaseSnapshotsStamp: "bun ../../scripts/stamp-release-snapshot.ts",
          changesetPublish: undefined
        }
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
