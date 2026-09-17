import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { formatScore } from "../../examples/shared/score-format.js"

describe("reflective feedback decimal formatting", () => {
  it.effect("retains fixed precision and follows native rounding on both sides of a boundary", () =>
    Effect.sync(() => {
      expect(formatScore(0, 2)).toBe("0.00")
      expect(formatScore(1, 2)).toBe("1.00")
      expect(formatScore(0.8, 2)).toBe("0.80")
      expect(formatScore(0.1249, 2)).toBe("0.12")
      expect(formatScore(0.125, 2)).toBe("0.13")
      expect(formatScore(0.1251, 2)).toBe("0.13")
      expect(formatScore(0.8, 3)).toBe("0.800")
      expect(formatScore(0.1236, 3)).toBe("0.124")
    }))
})
