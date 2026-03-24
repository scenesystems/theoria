import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { factorialValidated, gcdValidated } from "../../src/Algebra/operations.js"

describe("Algebra runtime boundary contracts", () => {
  it.effect("accepts canonical valid factorial input", () =>
    Effect.gen(function*() {
      const result = yield* factorialValidated({ n: 5 })
      expect(result).toBe(120)
    }))

  it.effect("accepts canonical valid gcd input", () =>
    Effect.gen(function*() {
      const result = yield* gcdValidated({ a: 12, b: 8 })
      expect(result).toBe(4)
    }))

  it.effect("rejects excess properties on factorial with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(factorialValidated({ n: 5, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("AlgebraDecodeError")
      }
    }))

  it.effect("rejects excess properties on gcd with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(gcdValidated({ a: 12, b: 8, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("AlgebraDecodeError")
      }
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(factorialValidated({ n: "bad" }))
      expect(result._tag).toBe("Left")
    }))
})
