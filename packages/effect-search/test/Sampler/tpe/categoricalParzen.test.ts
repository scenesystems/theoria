import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { buildCategoricalParzen } from "../../../src/internal/tpe/categoricalParzen.js"

const probabilitySum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)

describe("tpe categorical parzen", () => {
  it.effect("returns a normalized positive distribution for observed categories", () =>
    Effect.gen(function*() {
      const result = yield* buildCategoricalParzen(["adam", "sgd", "adamw"], ["adam", "adam", "sgd", "adamw", "adam"])

      yield* Effect.sync(() => {
        expect(result.probabilities).toHaveLength(3)
        expect(probabilitySum(result.probabilities)).toBeCloseTo(1, 12)

        result.probabilities.forEach((probability) => {
          expect(probability).toBeGreaterThan(0)
        })
      })
    }))

  it.effect("falls back to a uniform distribution when observations are empty", () =>
    Effect.gen(function*() {
      const result = yield* buildCategoricalParzen(["adam", "sgd", "adamw"], [])

      yield* Effect.sync(() => {
        expect(result.probabilities).toEqual([1 / 3, 1 / 3, 1 / 3])
      })
    }))

  it.effect("exposes a kernel list in the north-star API (one per observation plus prior)", () =>
    Effect.gen(function*() {
      const result = yield* buildCategoricalParzen(["adam", "sgd", "adamw"], ["adam", "adam", "sgd", "adamw", "adam"])
      const kernels = result.kernels

      yield* Effect.sync(() => {
        expect(kernels).toHaveLength(6)
      })
    }))
})
