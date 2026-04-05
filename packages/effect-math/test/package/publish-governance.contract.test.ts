import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import {
  buildPackedManifestFixture,
  loadPublishReadinessManifest,
  packageNameFromString,
  publishReadinessProfile,
  publishReadinessReport,
  readOptionalTextFile
} from "../../../source-proof/src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const resolvePackageRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path

  return yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
})

describe("package publish governance", () => {
  it.effect("keeps source and packed public-surface truth aligned to the root release framework", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const root = yield* resolvePackageRoot
      const profile = yield* Option.match(publishReadinessProfile(packageNameFromString("effect-math")), {
        onNone: () => Effect.die("missing effect-math publish-readiness profile"),
        onSome: Effect.succeed
      })
      const rootManifest = yield* loadPublishReadinessManifest(path.join(root, "package.json"))
      const readmeText = yield* readOptionalTextFile(path.join(root, "README.md")).pipe(
        Effect.map((readmeOption) => Option.getOrElse(readmeOption, () => ""))
      )
      const report = publishReadinessReport({
        profile,
        rootManifest,
        packedManifest: buildPackedManifestFixture(rootManifest),
        readmeText,
        requirePackedManifest: true,
        enforceMonorepoTopology: true
      })

      expect(report.errors).toEqual([])
      expect(report.todos).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps README-advertised imports on the same manifest authority as publish:check", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fileSystem = yield* FileSystem.FileSystem
      const root = yield* resolvePackageRoot
      const rootManifest = yield* loadPublishReadinessManifest(path.join(root, "package.json"))
      const packedManifest = buildPackedManifestFixture(rootManifest)
      const readmeText = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)
      const advertisedSubpaths = Arr.make(
        "./Statistics",
        "./LinearAlgebra",
        "./Geometry",
        "./Probability",
        "./Special",
        "./Distribution",
        "./Complex",
        "./contracts"
      )

      yield* Effect.forEach(
        advertisedSubpaths,
        (subpath) =>
          Effect.sync(() => {
            const importSpecifier = subpath === "./contracts"
              ? "effect-math/contracts"
              : `effect-math/${subpath.slice(2)}`

            expect(readmeText).toContain(importSpecifier)
            expect(rootManifest.exports?.[subpath]).toBeDefined()
            expect(packedManifest.exports?.[subpath]).toBeDefined()
          }),
        { discard: true }
      )

      expect(rootManifest.exports?.["./internal/*"]).toBeNull()
      expect(packedManifest.exports?.["./internal/*"]).toBeNull()
      expect(readmeText).not.toContain("effect-math/internal")
      expect(readmeText).toContain("weightedMean")
      expect(readmeText).toContain("normalizeBeneficial")
      expect(readmeText).toContain("normalizeInverseBudget")
      expect(readmeText).toContain("lossSummary")
      expect(readmeText).not.toContain("ScoreProfile")
      expect(readmeText).not.toContain("WorkflowEvaluationReport")
      expect(readmeText).not.toContain("ScoreComponentKind")
    }).pipe(Effect.provide(BunContext.layer)))
})
