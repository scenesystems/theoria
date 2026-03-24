import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Option, Schema } from "effect"

import { maximum, minimum } from "../../src/Statistics/internal/estimators.js"
import { covariance, mean, standardDeviation, variance } from "../../src/Statistics/operations.js"
import { FixtureRegistryLive, loadFixture, StatisticsEstimatorParityFixtureSchema } from "../helpers/fixtures/index.js"

const MEAN_VAR_STDDEV_TOLERANCE = 1e-12
const COVARIANCE_TOLERANCE = 1e-10
const MINMAX_TOLERANCE = 1e-15

const expectWithinTolerance = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Statistics SciPy fixture parity", () => {
  it.effect("all estimator-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("statistics.estimator-parity")
      const fixture = yield* Schema.decodeUnknown(StatisticsEstimatorParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "mean" }, (v) =>
              expectWithinTolerance(mean(Chunk.fromIterable(v.input.values)), v.expected, MEAN_VAR_STDDEV_TOLERANCE)),
            Match.when({ operation: "variance" }, (v) =>
              expectWithinTolerance(
                variance(Chunk.fromIterable(v.input.values)),
                v.expected,
                MEAN_VAR_STDDEV_TOLERANCE
              )),
            Match.when({ operation: "standardDeviation" }, (v) =>
              expectWithinTolerance(
                standardDeviation(Chunk.fromIterable(v.input.values)),
                v.expected,
                MEAN_VAR_STDDEV_TOLERANCE
              )),
            Match.when({ operation: "covariance" }, (v) =>
              expectWithinTolerance(
                covariance(Chunk.fromIterable(v.input.a), Chunk.fromIterable(v.input.b)),
                v.expected,
                COVARIANCE_TOLERANCE
              )),
            Match.when({ operation: "minMax" }, (v) => {
              const chunk = Chunk.fromIterable(v.input.values)
              expectWithinTolerance(
                Option.getOrElse(minimum(chunk), () =>
                  0),
                v.expected.min,
                MINMAX_TOLERANCE
              )
              expectWithinTolerance(
                Option.getOrElse(maximum(chunk), () =>
                  0),
                v.expected.max,
                MINMAX_TOLERANCE
              )
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
