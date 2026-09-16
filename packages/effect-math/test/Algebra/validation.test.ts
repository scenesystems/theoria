import { describe, expect, it } from "@effect/vitest"
import { Array, Effect } from "effect"

import { factorialValidated, polyEvalValidated } from "../../src/Algebra.js"

describe("Algebra runtime boundary contracts", () => {
  it.effect("accepts canonical polynomial and factorial inputs", () =>
    Effect.gen(function*() {
      expect(yield* polyEvalValidated({ coefficients: Array.make(1, 2, 3), x: 2 })).toBe(17)
      expect(yield* factorialValidated({ n: 6 })).toBe(720)
    }))

  it.effect("reports excess polynomial fields as typed decode failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(polyEvalValidated({ coefficients: Array.make(1, 2), x: 2, extra: true }))
      expect(error._tag).toBe("AlgebraDecodeError")
      expect(error.operation).toBe("polyEval")
    }))

  it.effect("reports fractional factorial inputs as typed decode failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(factorialValidated({ n: 2.5 }))
      expect(error._tag).toBe("AlgebraDecodeError")
      expect(error.operation).toBe("factorial")
    }))
})
