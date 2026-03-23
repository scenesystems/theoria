import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as N, Schema } from "effect"

import { expm1, log1p, sum } from "../../src/Numeric/operations.js"
import { FixtureRegistryLive, loadFixture, NumericScalarParityFixtureSchema } from "../helpers/fixtures/index.js"

const LOG1P_EXPM1_TOLERANCE = 1e-15
const SUM_TOLERANCE = 1.5

const expectWithinTolerance = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Numeric SciPy fixture parity", () => {
  it.effect("all scalar-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("numeric.scalar-parity")
      const fixture = yield* Schema.decodeUnknown(NumericScalarParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "log1p" }, (v) =>
              expectWithinTolerance(log1p(v.input.x), v.expected, LOG1P_EXPM1_TOLERANCE)),
            Match.when({ operation: "expm1" }, (v) =>
              expectWithinTolerance(expm1(v.input.x), v.expected, LOG1P_EXPM1_TOLERANCE)),
            Match.when({ operation: "sum" }, (v) =>
              expectWithinTolerance(sum(v.input.values), v.expected, SUM_TOLERANCE)),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
