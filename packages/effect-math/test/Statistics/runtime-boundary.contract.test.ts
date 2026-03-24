import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { meanValidated, varianceValidated } from "../../src/Statistics/operations.js"

describe("Statistics runtime boundary contracts", () => {
  it.effect("accepts canonical valid mean input", () =>
    Effect.gen(function*() {
      const result = yield* meanValidated({ values: [2, 4, 6] })
      expect(result).toBe(4)
    }))

  it.effect("accepts canonical valid variance input", () =>
    Effect.gen(function*() {
      const result = yield* varianceValidated({ values: [2, 4, 6] })
      expect(result).toBe(4)
    }))

  it.effect("rejects excess properties on mean with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(meanValidated({ values: [2, 4, 6], extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("StatisticsDecodeError")
      }
    }))

  it.effect("rejects excess properties on variance with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(varianceValidated({ values: [2, 4, 6], extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("StatisticsDecodeError")
      }
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(meanValidated({ values: "not-an-array" }))
      expect(result._tag).toBe("Left")
    }))
})
