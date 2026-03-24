import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { erfValidated, gammaValidated } from "../../src/Special/operations.js"

describe("Special runtime boundary contracts", () => {
  it.effect("accepts canonical valid gamma input", () =>
    Effect.gen(function*() {
      const result = yield* gammaValidated({ x: 5 })
      expect(result).toBeCloseTo(24, 6)
    }))

  it.effect("accepts canonical valid erf input", () =>
    Effect.gen(function*() {
      const result = yield* erfValidated({ x: 0 })
      expect(result).toBe(0)
    }))

  it.effect("rejects excess properties on gamma with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(gammaValidated({ x: 5, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("SpecialDecodeError")
      }
    }))

  it.effect("rejects excess properties on erf with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(erfValidated({ x: 0, extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("SpecialDecodeError")
      }
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(gammaValidated({ x: "bad" }))
      expect(result._tag).toBe("Left")
    }))
})
