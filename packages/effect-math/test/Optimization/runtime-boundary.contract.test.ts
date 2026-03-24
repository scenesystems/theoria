import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { bisectValidated, goldenSectionValidated } from "../../src/Optimization/operations.js"

describe("Optimization runtime boundary contracts", () => {
  it.effect("accepts canonical valid bisect input", () =>
    Effect.gen(function*() {
      const result = yield* bisectValidated((x) => x * x - 2, { a: 0, b: 2 })
      expect(result).toBeCloseTo(1.41421, 4)
    }))

  it.effect("accepts canonical valid goldenSection input", () =>
    Effect.gen(function*() {
      const result = yield* goldenSectionValidated((x) => x * x, { a: -2, b: 2 })
      expect(result).toBeCloseTo(0, 4)
    }))

  it.effect("rejects excess properties on bisect with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(bisectValidated((x) => x * x - 2, { a: 0, b: 2, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("OptimizationDecodeError")
      }
    }))

  it.effect("rejects excess properties on goldenSection with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(goldenSectionValidated((x) => x * x, { a: -2, b: 2, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("OptimizationDecodeError")
      }
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(bisectValidated((x) => x, { a: "bad", b: 2 }))
      expect(result._tag).toBe("Left")
    }))
})
