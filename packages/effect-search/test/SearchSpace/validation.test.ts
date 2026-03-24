import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either } from "effect"

import * as SearchSpace from "../../src/SearchSpace/index.js"

const callCategorical = (choices: unknown) =>
  globalThis.Function.prototype.call.call(SearchSpace.categorical, undefined, choices)

describe("SearchSpace validation", () => {
  it.effect("rejects empty categorical choices", () =>
    Effect.gen(function*() {
      const emptyChoices = Arr.empty<unknown>()
      const result = yield* Effect.either(
        SearchSpace.make({
          optimizer: callCategorical(emptyChoices)
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toBe("categorical choices must be non-empty")
      }
    }))

  it.effect("rejects non-primitive categorical choices", () =>
    Effect.gen(function*() {
      const nestedChoices = [{ nested: true }]
      const result = yield* Effect.either(
        SearchSpace.make({
          optimizer: callCategorical(nestedChoices)
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toBe("categorical choices must be primitives (string | number | boolean | null)")
      }
    }))

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
