import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Number as Num } from "effect"

import * as SearchSpace from "../../src/SearchSpace.js"

describe("SearchSpace validation", () => {
  it.effect("rejects float dimensions where low is greater than high", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          learningRate: SearchSpace.float(10, 1)
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.mapLeft(result, (failure) => {
        expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
        expect(failure.reason).toBe("float low cannot be greater than high")
      })
    }))

  it.effect("rejects log-scaled float dimensions where low is not positive", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          learningRate: SearchSpace.float(Num.negate(1), 10, { scale: "log" })
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.mapLeft(result, (failure) => {
        expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
        expect(failure.reason).toBe("log-scaled float dimensions require low > 0")
      })
    }))

  it.effect("rejects non-positive integer steps", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          steps: SearchSpace.int(1, 10, { step: 0 })
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.mapLeft(result, (failure) => {
        expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
        expect(failure.reason).toBe("step must be greater than 0")
      })
    }))

  it.effect("rejects non-integer fidelity bounds", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          budget: SearchSpace.fidelity(1.5, 9)
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.mapLeft(result, (failure) => {
        expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
        expect(failure.reason).toBe("int bounds must be integers")
      })
    }))
})
