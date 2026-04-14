import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import {
  buildPackedManifestFixture,
  loadPublishReadinessManifest,
  packageNameFromString,
  publishReadinessProfile,
  publishReadinessReport,
  readOptionalTextFile
} from "../../packages/source-proof/src/index.js"

const legacyReleaseHosts: ReadonlyArray<{
  readonly packageName: string
  readonly publishReadinessHostPath: string
  readonly releaseSnapshotHostPath: string
}> = [
  {
    packageName: "effect-math",
    publishReadinessHostPath: "packages/effect-math/scripts/verify-publish-readiness.ts",
    releaseSnapshotHostPath: "packages/effect-math/stamp-release-snapshot.ts"
  },
  {
    packageName: "effect-search",
    publishReadinessHostPath: "packages/effect-search/scripts/verify-publish-readiness.ts",
    releaseSnapshotHostPath: "packages/effect-search/stamp-release-snapshot.ts"
  }
]

describe("release framework publish-check convergence", () => {
  it.effect("removes duplicate package-local release hosts for the former framework owners", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const legacyHosts = yield* Effect.forEach(
        legacyReleaseHosts,
        (legacyHost) =>
          Effect.gen(function*() {
            const publishReadinessHostExists = yield* fileSystem.exists(
              path.join(process.cwd(), legacyHost.publishReadinessHostPath)
            ).pipe(Effect.orDie)
            const releaseSnapshotHostExists = yield* fileSystem.exists(
              path.join(process.cwd(), legacyHost.releaseSnapshotHostPath)
            ).pipe(Effect.orDie)

            return {
              packageName: legacyHost.packageName,
              publishReadinessHostExists,
              releaseSnapshotHostExists
            }
          }),
        { concurrency: "unbounded" }
      )

      expect(legacyHosts).toEqual([
        {
          packageName: "effect-math",
          publishReadinessHostExists: false,
          releaseSnapshotHostExists: false
        },
        {
          packageName: "effect-search",
          publishReadinessHostExists: false,
          releaseSnapshotHostExists: false
        }
      ])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps packed-manifest validation and issue taxonomy on the root authority for the former duplicate hosts", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const reports = yield* Effect.forEach(
        legacyReleaseHosts,
        ({ packageName }) =>
          Effect.gen(function*() {
            const profileOption = publishReadinessProfile(packageNameFromString(packageName))

            expect(Option.isSome(profileOption)).toBe(true)

            if (Option.isNone(profileOption)) {
              return null
            }

            const packageRoot = path.join(process.cwd(), `packages/${packageName}`)
            const rootManifest = yield* loadPublishReadinessManifest(path.join(packageRoot, "package.json"))
            const readme = yield* readOptionalTextFile(path.join(packageRoot, "README.md"))
            const packedManifest = buildPackedManifestFixture(rootManifest)
            const report = publishReadinessReport({
              profile: profileOption.value,
              rootManifest,
              packedManifest,
              ...(Option.isSome(readme) ? { readmeText: readme.value } : {}),
              requirePackedManifest: true,
              enforceMonorepoTopology: true
            })

            return {
              packageName,
              errors: report.errors,
              todos: report.todos
            }
          }),
        { concurrency: "unbounded" }
      )

      expect(reports).toEqual([
        {
          packageName: "effect-math",
          errors: [],
          todos: []
        },
        {
          packageName: "effect-search",
          errors: [],
          todos: []
        }
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
