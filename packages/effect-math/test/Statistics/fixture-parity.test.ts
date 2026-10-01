import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Match, Number, Option, Schema } from "effect"

import { abs } from "../../src/Numeric.js"
import { covariance, maximum, mean, minimum, standardDeviation, variance } from "../../src/Statistics.js"
import { loadFixture, StatisticsEstimatorParityFixtureSchema } from "../helpers/fixtures/index.js"

const meanVarianceStddevTolerance = 1e-12
const covarianceTolerance = 1e-10
const minMaxTolerance = 1e-15

const expectWithinTolerance = (actual: number, expected: number, tolerance: number) =>
  expect(Number.lessThanOrEqualTo(abs(Number.subtract(actual, expected)), tolerance)).toBe(true)

describe("Statistics SciPy fixture parity", () => {
  it.effect("all estimator-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("statistics.estimator-parity")
      const fixture = yield* Schema.decodeUnknown(StatisticsEstimatorParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "mean" }, (v) =>
              expectWithinTolerance(mean(Chunk.fromIterable(v.input.values)), v.expected, meanVarianceStddevTolerance)),
            Match.when({ operation: "variance" }, (v) =>
              expectWithinTolerance(
                variance(Chunk.fromIterable(v.input.values)),
                v.expected,
                meanVarianceStddevTolerance
              )),
            Match.when({ operation: "standardDeviation" }, (v) =>
              expectWithinTolerance(
                standardDeviation(Chunk.fromIterable(v.input.values)),
                v.expected,
                meanVarianceStddevTolerance
              )),
            Match.when({ operation: "covariance" }, (v) =>
              expectWithinTolerance(
                covariance(Chunk.fromIterable(v.input.a), Chunk.fromIterable(v.input.b)),
                v.expected,
                covarianceTolerance
              )),
            Match.when({ operation: "minMax" }, (v) => {
              const chunk = Chunk.fromIterable(v.input.values)
              expectWithinTolerance(
                Option.getOrElse(minimum(chunk), () =>
                  0),
                v.expected.min,
                minMaxTolerance
              )
              expectWithinTolerance(
                Option.getOrElse(maximum(chunk), () =>
                  0),
                v.expected.max,
                minMaxTolerance
              )
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
