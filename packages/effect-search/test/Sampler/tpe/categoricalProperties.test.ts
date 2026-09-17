import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, FastCheck as fc, Number as Num, Option } from "effect"

import { buildCategoricalParzen } from "../../../src/internal/tpe/categoricalParzen.js"

const sum = (values: Iterable<number>) => Arr.reduce(values, 0, Num.sum)

const valueAt = (values: Iterable<string>, index: number) => {
  const entries = Arr.fromIterable(values)
  return Arr.get(entries, index).pipe(Option.orElse(() => Arr.head(entries)), Option.getOrElse(() => "fallback"))
}

describe("property tests for categorical parzen", () => {
  it.effect.prop(
    "always produces normalized positive distributions",
    {
      choices: fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 5 }),
      observationIndices: fc.array(fc.integer({ min: 0, max: 1_000 }), { maxLength: 50 })
    },
    ({ choices, observationIndices }) =>
      Effect.gen(function*() {
        const observations = Arr.map(observationIndices, (index) =>
          valueAt(choices, Num.remainder(index, Arr.length(choices))))
        const distribution = yield* buildCategoricalParzen(choices, observations)

        expect(distribution.probabilities).toHaveLength(Arr.length(choices))
        expect(sum(distribution.probabilities)).toBeCloseTo(1, 12)

        Arr.forEach(distribution.probabilities, (probability) => {
          expect(probability).toBeGreaterThan(0)
        })
      })
  )
})
