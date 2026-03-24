import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as N, Schema } from "effect"

import { beta, digamma, erf, erfc, gamma, lnGamma } from "../../src/Special/operations.js"
import { FixtureRegistryLive, loadFixture, SpecialFunctionParityFixtureSchema } from "../helpers/fixtures/index.js"

const RELATIVE_TOLERANCE = 1e-7
const ABSOLUTE_TOLERANCE = 1e-12
const ERF_ABSOLUTE_TOLERANCE = 2e-7
const DIGAMMA_ABSOLUTE_TOLERANCE = 2e-12

const expectParity = (actual: number, expected: number, absoluteTol: number = ABSOLUTE_TOLERANCE) => {
  const absExpected = Math.abs(expected)
  const tolerance = absExpected > 1 ? N.multiply(absExpected, RELATIVE_TOLERANCE) : absoluteTol
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Special SciPy fixture parity", () => {
  it.effect("all function-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("special.function-parity")
      const fixture = yield* Schema.decodeUnknown(SpecialFunctionParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "gamma" }, (v) => expectParity(gamma(v.input.x), v.expected)),
            Match.when({ operation: "lnGamma" }, (v) => expectParity(lnGamma(v.input.x), v.expected)),
            Match.when({ operation: "beta" }, (v) => expectParity(beta(v.input.a, v.input.b), v.expected)),
            Match.when({ operation: "erf" }, (v) => expectParity(erf(v.input.x), v.expected, ERF_ABSOLUTE_TOLERANCE)),
            Match.when({ operation: "erfc" }, (v) => expectParity(erfc(v.input.x), v.expected, ERF_ABSOLUTE_TOLERANCE)),
            Match.when({ operation: "digamma" }, (v) =>
              expectParity(digamma(v.input.x), v.expected, DIGAMMA_ABSOLUTE_TOLERANCE)),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
