import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Effect, Match, Number, Schema } from "effect"

import { abs } from "../../src/Numeric.js"
import { betainc, erfcinv, erfinv, gammainc, gammaincc, polygamma } from "../../src/Special.js"
import { loadFixture, SpecialInverseParityFixtureSchema } from "../helpers/fixtures/index.js"

const relativeTolerance = 1e-9
const erfinvAbsoluteTolerance = 1e-9
const gammaincAbsoluteTolerance = 1e-10
const betaincAbsoluteTolerance = 1e-8
const polygammaAbsoluteTolerance = 1e-10
const defaultAbsoluteTolerance = 1e-10

const expectParity = (actual: number, expected: number, absoluteTol: number = defaultAbsoluteTolerance) => {
  const absExpected = abs(expected)
  const tolerance = Boolean.match(Number.greaterThan(absExpected, 1), {
    onTrue: () => Number.multiply(absExpected, relativeTolerance),
    onFalse: () => absoluteTol
  })
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Special inverse SciPy fixture parity", () => {
  it.effect("all inverse-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("special.inverse-parity")
      const fixture = yield* Schema.decodeUnknown(SpecialInverseParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when(
              { operation: "erfinv" },
              (v) => expectParity(erfinv(v.input.x), v.expected, erfinvAbsoluteTolerance)
            ),
            Match.when(
              { operation: "erfcinv" },
              (v) => expectParity(erfcinv(v.input.x), v.expected, erfinvAbsoluteTolerance)
            ),
            Match.when(
              { operation: "gammainc" },
              (v) => expectParity(gammainc(v.input.a, v.input.x), v.expected, gammaincAbsoluteTolerance)
            ),
            Match.when(
              { operation: "gammaincc" },
              (v) => expectParity(gammaincc(v.input.a, v.input.x), v.expected, gammaincAbsoluteTolerance)
            ),
            Match.when(
              { operation: "betainc" },
              (v) => expectParity(betainc(v.input.a, v.input.b, v.input.x), v.expected, betaincAbsoluteTolerance)
            ),
            Match.when(
              { operation: "polygamma" },
              (v) => expectParity(polygamma(v.input.n, v.input.x), v.expected, polygammaAbsoluteTolerance)
            ),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
