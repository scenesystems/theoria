import { describe, expect, it } from "@effect/vitest"
import { Effect, Runtime } from "effect"
import fc from "fast-check"

import { buildCategoricalParzen } from "../../src/internal/tpe/categoricalParzen.js"

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)

const valueAt = (values: ReadonlyArray<string>, index: number) => values[index] ?? values[0] ?? "fallback"

const runSync = Runtime.runSync(Runtime.defaultRuntime)

describe("property tests for categorical parzen", () => {
  it.effect("always produces normalized positive distributions", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.integer({ min: 0, max: 1_000 }), { maxLength: 50 }),
          (choices, observationIndices) => {
            const observations = observationIndices.map((index) => valueAt(choices, index % choices.length))
            const distribution = runSync(buildCategoricalParzen(choices, observations).pipe(Effect.orDie))

            expect(distribution.probabilities).toHaveLength(choices.length)
            expect(sum(distribution.probabilities)).toBeCloseTo(1, 12)

            distribution.probabilities.forEach((probability) => {
              expect(probability).toBeGreaterThan(0)
            })
          }
        )
      )
    }))
})
