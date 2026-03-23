import { describe, expect, it } from "@effect/vitest"
import { Effect, Record as EffectRecord } from "effect"
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

      internalBlocks.forEach((path) => {
        expect(exportsRecord[path]).toBeNull()
      })
    }))
})
