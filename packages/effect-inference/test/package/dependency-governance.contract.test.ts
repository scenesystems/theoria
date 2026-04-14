import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Record, Schema } from "effect"

import packageJson from "../../package.json" with { type: "json" }

const packageRootUrl = new URL("../../", import.meta.url)

const PackageGovernanceSchema = Schema.Struct({
  dependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  optionalDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  peerDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  scripts: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const manifest = Schema.decodeUnknownSync(PackageGovernanceSchema)(packageJson)
const runtimeDependencies = [
  ...Record.keys(manifest.dependencies ?? {}),
  ...Record.keys(manifest.optionalDependencies ?? {}),
  ...Record.keys(manifest.peerDependencies ?? {})
]

describe("package/dependency-governance", () => {
  it("keeps runtime dependencies free of Scene package authority and blocks internal subpaths", () => {
    expect(
      runtimeDependencies.some(
        (dependency) => dependency.startsWith("@scene/") || dependency.startsWith("@scenesystems/")
      )
    ).toBe(false)

    expect(manifest.exports["./internal/*"]).toBeNull()
  })

  it("does not introduce a package-owned publish-readiness authority", () => {
    expect(manifest.scripts?.["publish:check"]).toBeUndefined()
    expect(manifest.scripts?.["verify-publish-readiness"]).toBeUndefined()
  })

  it.effect("delegates release-snapshot and docgen governance to the root release framework", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const packageEntries = yield* fileSystem.readDirectory(root).pipe(Effect.orDie)

      expect(manifest.exports["./internal/*"]).toBeNull()
      expect(manifest.scripts?.["release-snapshots:stamp"]).toBe("bun ../../scripts/stamp-release-snapshot.ts")
      expect(manifest.scripts?.docgen).toBe("docgen")
      expect(packageEntries).not.toContain("stamp-release-snapshot.ts")
      expect(packageEntries).not.toContain("verify-publish-readiness.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
