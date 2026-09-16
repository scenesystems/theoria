import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { normalPdfValidated, uniformPdfValidated } from "../../src/Probability/operations.js"

describe("Probability runtime boundary contracts", () => {
  it.effect("accepts canonical valid normalPdf input", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfValidated({ x: 0, mu: 0, sigma: 1 })
      expect(result).toBeCloseTo(0.3989, 3)
    }))

  it.effect("accepts canonical valid uniformPdf input", () =>
    Effect.gen(function*() {
      const result = yield* uniformPdfValidated({ x: 0.5, low: 0, high: 1 })
      expect(result).toBe(1)
    }))

  it.effect("rejects excess properties on normalPdf with typed decode error", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(normalPdfValidated({ x: 0, mu: 0, sigma: 1, extra: true }))
      expect(error._tag).toBe("ProbabilityDecodeError")
      expect(error.operation).toBe("normalPdf")
    }))

  it.effect("rejects excess properties on uniformPdf with typed decode error", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(uniformPdfValidated({ x: 0.5, low: 0, high: 1, extra: true }))
      expect(error._tag).toBe("ProbabilityDecodeError")
      expect(error.operation).toBe("uniformPdf")
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(normalPdfValidated({ x: "bad", mu: 0, sigma: 1 }))
      expect(error._tag).toBe("ProbabilityDecodeError")
      expect(error.operation).toBe("normalPdf")
    }))
})
