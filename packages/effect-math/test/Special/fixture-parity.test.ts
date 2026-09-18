import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Effect, Match, Number, Schema } from "effect"

import { abs } from "../../src/Numeric.js"
import { beta, digamma, erf, erfc, gamma, lnGamma } from "../../src/Special.js"
import { loadFixture, SpecialFunctionParityFixtureSchema } from "../helpers/fixtures/index.js"

const relativeTolerance = 1e-7
const absoluteTolerance = 1e-12
const erfAbsoluteTolerance = 2e-14
const digammaAbsoluteTolerance = 2e-12

const expectParity = (actual: number, expected: number, absoluteTol: number = absoluteTolerance) => {
  const absExpected = abs(expected)
  const tolerance = Boolean.match(Number.greaterThan(absExpected, 1), {
    onTrue: () => Number.multiply(absExpected, relativeTolerance),
    onFalse: () => absoluteTol
  })
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Special SciPy fixture parity", () => {
  it.effect("all function-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("special.function-parity")
      const fixture = yield* Schema.decodeUnknown(SpecialFunctionParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "gamma" }, (v) => expectParity(gamma(v.input.x), v.expected)),
            Match.when({ operation: "lnGamma" }, (v) => expectParity(lnGamma(v.input.x), v.expected)),
            Match.when({ operation: "beta" }, (v) => expectParity(beta(v.input.a, v.input.b), v.expected)),
            Match.when({ operation: "erf" }, (v) => expectParity(erf(v.input.x), v.expected, erfAbsoluteTolerance)),
            Match.when({ operation: "erfc" }, (v) => expectParity(erfc(v.input.x), v.expected, erfAbsoluteTolerance)),
            Match.when({ operation: "digamma" }, (v) =>
              expectParity(digamma(v.input.x), v.expected, digammaAbsoluteTolerance)),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
