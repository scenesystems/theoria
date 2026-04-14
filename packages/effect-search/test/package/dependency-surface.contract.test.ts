import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Order, Record, Schema } from "effect"

import packageJson from "../../package.json" with { type: "json" }
import * as EffectSearch from "../../src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const PackageSurfaceSchema = Schema.Struct({
  dependencies: Schema.Record({ key: Schema.String, value: Schema.String }),
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const packageSurface = Schema.decodeUnknownSync(PackageSurfaceSchema)(packageJson)

describe("package/dependency-surface", () => {
  it("keeps effect-math as an implementation dependency rather than a re-exported public namespace", () => {
    const rootNamespaces = Arr.sort(Record.keys(EffectSearch), Order.string)

    expect(packageSurface.dependencies["effect-math"]).toBeDefined()
    expect(packageSurface.exports["./Numeric"]).toBeUndefined()
    expect(packageSurface.exports["./Probability"]).toBeUndefined()
    expect(packageSurface.exports["./Statistics"]).toBeUndefined()
    expect(rootNamespaces).not.toContain("Numeric")
    expect(rootNamespaces).not.toContain("Probability")
    expect(rootNamespaces).not.toContain("Statistics")
    expect(rootNamespaces).not.toContain("Geometry")
    expect(rootNamespaces).not.toContain("LinearAlgebra")
    expect(rootNamespaces).not.toContain("Special")
  })

  it.effect("documents the public effect-math relationship without claiming effect-math re-exports", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(readme).toContain("Public `effect-math` alignment")
      expect(readme).toContain("stable numeric, probability, geometry, linear-algebra, and summary-statistics kernels")
      expect(readme).toContain("optimizer-specific acquisition, density, and scheduling logic stay package-owned")
    }).pipe(Effect.provide(BunContext.layer)))
})
