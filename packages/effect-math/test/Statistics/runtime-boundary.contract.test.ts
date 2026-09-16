import { describe, expect, it } from "@effect/vitest"
import { Array, Effect } from "effect"

import { meanValidated, varianceValidated } from "../../src/Statistics/operations.js"

describe("Statistics runtime boundary contracts", () => {
  it.effect("accepts canonical mean and variance inputs", () =>
    Effect.gen(function*() {
      expect(yield* meanValidated({ values: Array.make(2, 4, 6) })).toBe(4)
      expect(yield* varianceValidated({ values: Array.make(2, 4, 6) })).toBe(4)
    }))

  it.effect("reports excess mean fields as typed decode failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(meanValidated({ values: Array.make(2, 4, 6), extra: true }))
      expect(error._tag).toBe("StatisticsDecodeError")
      expect(error.operation).toBe("mean")
    }))

  it.effect("reports singleton variance as a typed shape failure", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(varianceValidated({ values: Array.of(2) }))
      expect(error._tag).toBe("StatisticsShapeError")
    }))
})
