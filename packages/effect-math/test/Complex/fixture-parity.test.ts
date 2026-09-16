import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Effect, Match, Number, Schema } from "effect"

import * as Complex from "../../src/Complex.js"
import * as Numeric from "../../src/Numeric.js"
import { ComplexArithmeticParityFixtureSchema, loadFixture } from "../helpers/fixtures/index.js"

const expectParity = (actual: number, expected: number, absoluteTolerance: number = 1e-12) => {
  const tolerance = Boolean.match(Number.greaterThan(Numeric.abs(expected), 1), {
    onTrue: () => Number.multiply(Numeric.abs(expected), 1e-12),
    onFalse: () => absoluteTolerance
  })
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const expectComplex = (actual: Complex.Complex, re: number, im: number, tolerance: number = 1e-12) => {
  expectParity(actual.re, re, tolerance)
  expectParity(actual.im, im, tolerance)
}

describe("Complex SciPy fixture parity", () => {
  it.effect("matches every arithmetic, polar, and trigonometric fixture", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("complex.arithmetic-parity")
      const fixture = yield* Schema.decodeUnknown(ComplexArithmeticParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "add" }, (v) =>
              expectComplex(
                Complex.add(Complex.make(v.input.aRe, v.input.aIm), Complex.make(v.input.bRe, v.input.bIm)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "subtract" }, (v) =>
              expectComplex(
                Complex.subtract(Complex.make(v.input.aRe, v.input.aIm), Complex.make(v.input.bRe, v.input.bIm)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "multiply" }, (v) =>
              expectComplex(
                Complex.multiply(Complex.make(v.input.aRe, v.input.aIm), Complex.make(v.input.bRe, v.input.bIm)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "divide" }, (v) =>
              expectComplex(
                Complex.divide(Complex.make(v.input.aRe, v.input.aIm), Complex.make(v.input.bRe, v.input.bIm)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "conjugate" }, (v) => {
              const result = Complex.conjugate(Complex.make(v.input.re, v.input.im))
              expectComplex(result, v.expected.re, v.expected.im)
            }),
            Match.when({ operation: "abs" }, (v) =>
              expectParity(Complex.abs(Complex.make(v.input.re, v.input.im)), v.expected)),
            Match.when({ operation: "arg" }, (v) =>
              expectParity(Complex.arg(Complex.make(v.input.re, v.input.im)), v.expected)),
            Match.when({ operation: "exp" }, (v) =>
              expectComplex(
                Complex.exp(Complex.make(v.input.re, v.input.im)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "log" }, (v) =>
              expectComplex(
                Complex.log(Complex.make(v.input.re, v.input.im)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "sqrt" }, (v) =>
              expectComplex(
                Complex.sqrt(Complex.make(v.input.re, v.input.im)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "pow" }, (v) =>
              expectComplex(
                Complex.pow(Complex.make(v.input.baseRe, v.input.baseIm), Complex.make(v.input.expRe, v.input.expIm)),
                v.expected.re,
                v.expected.im
              )),
            Match.when({ operation: "sin" }, (v) => {
              const result = Complex.sin(Complex.make(v.input.re, v.input.im))
              expectComplex(result, v.expected.re, v.expected.im, 1e-14)
            }),
            Match.when({ operation: "cos" }, (v) => {
              const result = Complex.cos(Complex.make(v.input.re, v.input.im))
              expectComplex(result, v.expected.re, v.expected.im, 1e-14)
            }),
            Match.when({ operation: "tan" }, (v) => {
              const result = Complex.tan(Complex.make(v.input.re, v.input.im))
              expectComplex(result, v.expected.re, v.expected.im, 1e-14)
            }),
            Match.when({ operation: "sinh" }, (v) => {
              const result = Complex.sinh(Complex.make(v.input.re, v.input.im))
              expectComplex(result, v.expected.re, v.expected.im, 1e-14)
            }),
            Match.when({ operation: "cosh" }, (v) => {
              const result = Complex.cosh(Complex.make(v.input.re, v.input.im))
              expectComplex(result, v.expected.re, v.expected.im, 1e-14)
            }),
            Match.when({ operation: "tanh" }, (v) => {
              const result = Complex.tanh(Complex.make(v.input.re, v.input.im))
              expectComplex(result, v.expected.re, v.expected.im, 1e-14)
            }),
            Match.when({ operation: "toPolar" }, (v) => {
              const [radius, angle] = Complex.toPolar(Complex.make(v.input.re, v.input.im))
              expectParity(radius, v.expected.r)
              expectParity(angle, v.expected.theta)
            }),
            Match.when({ operation: "complexDerivative" }, () =>
              undefined),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
