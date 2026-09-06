import { describe, expect, it } from "@effect/vitest"
import { Effect, FastCheck as fc } from "effect"

import { buildCategoricalParzen } from "../../src/internal/tpe/categoricalParzen.js"

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)

const valueAt = (values: ReadonlyArray<string>, index: number) => values[index] ?? values[0] ?? "fallback"

describe("property tests for categorical parzen", () => {
  it.effect.prop(
    "always produces normalized positive distributions",
    {
      choices: fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 5 }),
      observationIndices: fc.array(fc.integer({ min: 0, max: 1_000 }), { maxLength: 50 })
    },
    ({ choices, observationIndices }) =>
      Effect.gen(function*() {
        const observations = observationIndices.map((index) => valueAt(choices, index % choices.length))
        const distribution = yield* buildCategoricalParzen(choices, observations)

        expect(distribution.probabilities).toHaveLength(choices.length)
        expect(sum(distribution.probabilities)).toBeCloseTo(1, 12)

        distribution.probabilities.forEach((probability) => {
          expect(probability).toBeGreaterThan(0)
        })
      })
  )
})
