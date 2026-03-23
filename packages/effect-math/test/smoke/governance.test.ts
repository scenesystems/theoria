import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Record as EffectRecord } from "effect"
import packageJson from "../../package.json" with { type: "json" }

const exportsMap = packageJson.exports
const exportsRecord: Record<string, unknown> = exportsMap

describe("effect-math governance", () => {
  it.effect("exposes the exact declared public subpath set", () =>
    Effect.gen(function*() {
      const exportPaths = [
        ".",
        "./contracts",
        "./experimental",
        "./Numeric",
        "./Algebra",
        "./LinearAlgebra",
        "./Calculus",
        "./Special",
        "./Probability",
        "./Statistics",
        "./Optimization",
        "./Geometry",
        "./internal/*",
        "./Numeric/internal/*",
        "./Algebra/internal/*",
        "./LinearAlgebra/internal/*",
        "./Calculus/internal/*",
        "./Special/internal/*",
        "./Probability/internal/*",
        "./Statistics/internal/*",
        "./Optimization/internal/*",
        "./Geometry/internal/*"
      ]

      expect(EffectRecord.keys(exportsRecord).sort()).toEqual([...exportPaths].sort())
    }))

  it.effect("blocks all internal subpath exports", () =>
    Effect.gen(function*() {
      const internalBlocks = [
        "./internal/*",
        "./Numeric/internal/*",
        "./Algebra/internal/*",
        "./LinearAlgebra/internal/*",
        "./Calculus/internal/*",
        "./Special/internal/*",
        "./Probability/internal/*",
        "./Statistics/internal/*",
        "./Optimization/internal/*",
        "./Geometry/internal/*"
      ]

      yield* Effect.forEach(internalBlocks, (path) =>
        Effect.sync(() => {
          expect(exportsRecord[path]).toBeNull()
        }))
    }))

  it.effect("keeps unstable experimental lane explicit and stable root free of experimental seams", () =>
    Effect.gen(function*() {
      const rootExport = exportsRecord["."]
      const experimentalExport = exportsRecord["./experimental"]

      expect(experimentalExport).toBe("./src/experimental/index.ts")

      expect(
        Match.value(rootExport).pipe(
          Match.when(Match.string, (value) => value.includes("experimental")),
          Match.orElse(() => false)
        )
      ).toBe(false)
    }))
})
