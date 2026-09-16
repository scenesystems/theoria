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
      const error = yield* Effect.flip(gammaValidated({ x: 5, extra: true }))
      expect(error._tag).toBe("SpecialDecodeError")
      expect(error.operation).toBe("gamma")
    }))

  it.effect("rejects excess properties on erf with typed decode error", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(erfValidated({ x: 0, extra: true }))
      expect(error._tag).toBe("SpecialDecodeError")
      expect(error.operation).toBe("erf")
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(gammaValidated({ x: "bad" }))
      expect(error._tag).toBe("SpecialDecodeError")
      expect(error.operation).toBe("gamma")
    }))
})
