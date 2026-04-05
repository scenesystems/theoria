import { describe, expect, it } from "@effect/vitest"
import { Record, Schema } from "effect"

import packageJson from "../../package.json" with { type: "json" }

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
})
