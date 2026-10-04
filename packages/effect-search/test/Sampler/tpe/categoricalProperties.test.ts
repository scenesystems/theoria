import { describe, expect, it } from "@effect/vitest"
import { Arbitrary, Array as Arr, Effect, Number as Num, Option, Schema } from "effect"

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
      choices: Arbitrary.schema(
        Schema.UniqueArray(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(6)))
          .check(Schema.isMinLength(1), Schema.isMaxLength(5))
      ),
      observationIndices: Arbitrary.array(
        Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 1_000 }))),
        { maxLength: 50 }
      )
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
