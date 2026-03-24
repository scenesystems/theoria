import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { simpsonValidated, trapezoidValidated } from "../../src/Calculus/operations.js"

describe("Calculus runtime boundary contracts", () => {
  it.effect("accepts canonical valid trapezoid input", () =>
    Effect.gen(function*() {
      const result = yield* trapezoidValidated({ values: [0, 1, 4, 9, 16], dx: 1 })
      expect(result).toBe(22)
    }))

  it.effect("accepts canonical valid simpson input", () =>
    Effect.gen(function*() {
      const result = yield* simpsonValidated({ values: [0, 1, 4, 9, 16], dx: 1 })
      expect(result).toBeCloseTo(21.333, 2)
    }))

  it.effect("rejects excess properties on trapezoid with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(trapezoidValidated({ values: [0, 1, 4, 9, 16], dx: 1, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("CalculusDecodeError")
      }
    }))

  it.effect("rejects excess properties on simpson with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(simpsonValidated({ values: [0, 1, 4, 9, 16], dx: 1, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("CalculusDecodeError")
      }
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(trapezoidValidated({ values: "not-an-array", dx: 1 }))
      expect(result._tag).toBe("Left")
    }))
})
