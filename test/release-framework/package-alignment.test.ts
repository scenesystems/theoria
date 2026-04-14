import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  loadPublishReadinessManifest,
  publishReadinessReport,
  readOptionalTextFile,
  TheoriaReleaseFrameworkAuthority
} from "../../packages/source-proof/src/index.js"

describe("release framework package alignment", () => {
  it.effect("keeps the full shipped suite aligned to the shared root framework without package-local release owners", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fileSystem = yield* FileSystem.FileSystem
      const reports = yield* Effect.forEach(
        TheoriaReleaseFrameworkAuthority.governedPackages,
        (profile) =>
          Effect.gen(function*() {
            const packageRoot = path.join(process.cwd(), profile.packageDirectory)
            const manifest = yield* loadPublishReadinessManifest(path.join(packageRoot, "package.json"))
            const readme = yield* readOptionalTextFile(path.join(packageRoot, "README.md"))
            const snapshotsDirectory = path.join(packageRoot, "test/package/release-snapshots")
            const snapshotsDirectoryExists = yield* fileSystem.exists(snapshotsDirectory).pipe(Effect.orDie)

            expect(snapshotsDirectoryExists).toBe(true)

            return publishReadinessReport({
              profile,
              rootManifest: manifest,
              ...(readme._tag === "Some" ? { readmeText: readme.value } : {})
            })
          }),
        { concurrency: "unbounded" }
      )

      expect(reports.map((report) => report.profile.packageName)).toEqual([
        "effect-math",
        "effect-search",
        "effect-dsp",
        "effect-text",
        "effect-inference",
        "@scenesystems/digest",
        "@scenesystems/seal",
        "@scenesystems/sign"
      ])
      expect(reports.flatMap((report) => report.errors)).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
