import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as N, Schema } from "effect"

import { betainc, erfcinv, erfinv, gammainc, gammaincc, polygamma } from "../../src/Special/operations.js"
import { FixtureRegistryLive, loadFixture, SpecialInverseParityFixtureSchema } from "../helpers/fixtures/index.js"

const RELATIVE_TOLERANCE = 1e-9
const ERFINV_ABSOLUTE_TOLERANCE = 1e-9
const GAMMAINC_ABSOLUTE_TOLERANCE = 1e-10
const BETAINC_ABSOLUTE_TOLERANCE = 1e-8
const POLYGAMMA_ABSOLUTE_TOLERANCE = 1e-10
const DEFAULT_ABSOLUTE_TOLERANCE = 1e-10

const expectParity = (actual: number, expected: number, absoluteTol: number = DEFAULT_ABSOLUTE_TOLERANCE) => {
  const absExpected = Math.abs(expected)
  const tolerance = absExpected > 1 ? N.multiply(absExpected, RELATIVE_TOLERANCE) : absoluteTol
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Special inverse SciPy fixture parity", () => {
  it.effect("all inverse-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("special.inverse-parity")
      const fixture = yield* Schema.decodeUnknown(SpecialInverseParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "erfinv" }, (v) =>
              expectParity(erfinv(v.input.x), v.expected, ERFINV_ABSOLUTE_TOLERANCE)),
            Match.when({ operation: "erfcinv" }, (v) =>
              expectParity(erfcinv(v.input.x), v.expected, ERFINV_ABSOLUTE_TOLERANCE)),
            Match.when({ operation: "gammainc" }, (v) =>
              expectParity(gammainc(v.input.a, v.input.x), v.expected, GAMMAINC_ABSOLUTE_TOLERANCE)),
            Match.when({ operation: "gammaincc" }, (v) =>
              expectParity(gammaincc(v.input.a, v.input.x), v.expected, GAMMAINC_ABSOLUTE_TOLERANCE)),
            Match.when({ operation: "betainc" }, (v) =>
              expectParity(betainc(v.input.a, v.input.b, v.input.x), v.expected, BETAINC_ABSOLUTE_TOLERANCE)),
            Match.when({ operation: "polygamma" }, (v) =>
              expectParity(polygamma(v.input.n, v.input.x), v.expected, POLYGAMMA_ABSOLUTE_TOLERANCE)),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
