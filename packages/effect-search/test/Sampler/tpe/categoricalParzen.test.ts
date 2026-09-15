import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num } from "effect"

import { buildCategoricalParzen } from "../../../src/internal/tpe/categoricalParzen.js"

describe("tpe categorical parzen", () => {
  it.effect("combines repeated observations with a uniform prior", () =>
    Effect.gen(function*() {
      const result = yield* buildCategoricalParzen(
        Arr.make("adam", "sgd", "adamw"),
        Arr.make("adam", "adam", "sgd", "adamw", "adam")
      )
      // Five observation kernels contribute 7/9 to their category and 1/9
      // to the others; the sixth kernel is the uniform prior.
      const expected = Arr.make(Num.unsafeDivide(13, 27), Num.unsafeDivide(7, 27), Num.unsafeDivide(7, 27))
      yield* Effect.forEach(Arr.zip(result.probabilities, expected), ([actual, probability]) =>
        Effect.sync(() => expect(actual).toBeCloseTo(probability, 12)))
      expect(Num.sumAll(result.probabilities)).toBeCloseTo(1, 12)
      expect(Arr.length(result.probabilities)).toBe(3)
    }))

  it.effect("falls back to a uniform distribution when observations are empty", () =>
    Effect.gen(function*() {
      const result = yield* buildCategoricalParzen(Arr.make("adam", "sgd", "adamw"), Arr.empty())
      expect(result.probabilities).toEqual(Arr.replicate(Num.unsafeDivide(1, 3), 3))
    }))

  it.effect("weights nearby unobserved categories above distant categories", () =>
    Effect.gen(function*() {
      const result = yield* buildCategoricalParzen(Arr.make(0, 1, 2), Arr.make(0, 0, 0), {
        distance: (_observed, candidate) =>
          Match.value(candidate).pipe(
            Match.when(0, () => 0),
            Match.when(1, () => 0.25),
            Match.orElse(() => 1)
          )
      })
      const observed = yield* Arr.get(result.probabilities, 0)
      const nearby = yield* Arr.get(result.probabilities, 1)
      const distant = yield* Arr.get(result.probabilities, 2)
      expect(observed).toBeGreaterThan(nearby)
      expect(nearby).toBeGreaterThan(distant)
      expect(distant).toBeGreaterThan(0)
      expect(Num.sumAll(result.probabilities)).toBeCloseTo(1, 12)
    }))
})
