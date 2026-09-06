import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import * as SearchSpace from "../../src/SearchSpace/index.js"

describe("SearchSpace validation", () => {
  it.effect("rejects float dimensions where low is greater than high", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          learningRate: SearchSpace.float(10, 1)
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toBe("float low cannot be greater than high")
      }
    }))

  it.effect("rejects log-scaled float dimensions where low is not positive", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          learningRate: SearchSpace.float(-1, 10, { scale: "log" })
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toBe("log-scaled float dimensions require low > 0")
      }
    }))

  it.effect("rejects non-positive integer steps", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          steps: SearchSpace.int(1, 10, { step: 0 })
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toBe("step must be greater than 0")
      }
    }))

  it.effect("rejects non-integer fidelity bounds", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.make({
          budget: SearchSpace.fidelity(1.5, 9)
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toBe("int bounds must be integers")
      }
    }))
})
