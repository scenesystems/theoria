import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Effect, Match, Number, Schema } from "effect"

import type { Complex } from "../../src/Complex/model.js"
import {
  abs,
  add,
  arg,
  complexDerivative,
  conjugate,
  cos,
  cosh,
  divide,
  exp,
  log,
  multiply,
  of,
  pow,
  sin,
  sinh,
  sqrt,
  subtract,
  tan,
  tanh,
  toPolar
} from "../../src/Complex/operations.js"
import * as Numeric from "../../src/Numeric/index.js"
import { ComplexArithmeticParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

const ARITHMETIC_TOLERANCE = 1e-12
const TRIG_TOLERANCE = 1e-14
const DEFAULT_TOLERANCE = 1e-12
const DerivativeName = Schema.Literal("square", "cube", "sin", "cos", "exp")

const expectParity = (actual: number, expected: number, absoluteTol: number = DEFAULT_TOLERANCE) => {
  const absExpected = Numeric.abs(expected)
  const tolerance = Boolean.match(Number.greaterThan(absExpected, 1), {
    onTrue: () => Number.multiply(absExpected, 1e-12),
    onFalse: () => absoluteTol
  })
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const expectComplexParity = (
  actualRe: number,
  actualIm: number,
  expectedRe: number,
  expectedIm: number,
  absoluteTol: number = DEFAULT_TOLERANCE
) => {
  expectParity(actualRe, expectedRe, absoluteTol)
  expectParity(actualIm, expectedIm, absoluteTol)
}

const resolveDerivativeFn = (input: unknown) =>
  Schema.decodeUnknown(DerivativeName)(input).pipe(
    Effect.map((name): (z: Complex) => Complex =>
      Match.value(name).pipe(
        Match.when("square", () => (z: Complex) => multiply(z, z)),
        Match.when("cube", () => (z: Complex) => multiply(multiply(z, z), z)),
        Match.when("sin", () => sin),
        Match.when("cos", () => cos),
        Match.when("exp", () => exp),
        Match.exhaustive
      )
    )
  )

describe("Complex arithmetic SciPy fixture parity", () => {
  it.effect("all arithmetic-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("complex.arithmetic-parity")
      const fixture = yield* Schema.decodeUnknown(ComplexArithmeticParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Effect.gen(function*() {
          const derivativeFn = yield* Match.value(c).pipe(
            Match.when({ operation: "complexDerivative" }, (value) => resolveDerivativeFn(value.input.fn)),
            Match.orElse(() => Effect.succeed(exp))
          )
          yield* Effect.sync(() =>
            Match.value(c).pipe(
              Match.when({ operation: "add" }, (v) => {
                const result = add(of(v.input.aRe, v.input.aIm), of(v.input.bRe, v.input.bIm))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "subtract" }, (v) => {
                const result = subtract(of(v.input.aRe, v.input.aIm), of(v.input.bRe, v.input.bIm))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "multiply" }, (v) => {
                const result = multiply(of(v.input.aRe, v.input.aIm), of(v.input.bRe, v.input.bIm))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "divide" }, (v) => {
                const result = divide(of(v.input.aRe, v.input.aIm), of(v.input.bRe, v.input.bIm))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "conjugate" }, (v) => {
                const result = conjugate(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "abs" }, (v) =>
                expectParity(abs(of(v.input.re, v.input.im)), v.expected, ARITHMETIC_TOLERANCE)),
              Match.when({ operation: "arg" }, (v) =>
                expectParity(arg(of(v.input.re, v.input.im)), v.expected, ARITHMETIC_TOLERANCE)),
              Match.when({ operation: "exp" }, (v) => {
                const result = exp(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "log" }, (v) => {
                const result = log(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "sqrt" }, (v) => {
                const result = sqrt(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "pow" }, (v) => {
                const result = pow(of(v.input.baseRe, v.input.baseIm), of(v.input.expRe, v.input.expIm))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "sin" }, (v) => {
                const result = sin(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, TRIG_TOLERANCE)
              }),
              Match.when({ operation: "cos" }, (v) => {
                const result = cos(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, TRIG_TOLERANCE)
              }),
              Match.when({ operation: "tan" }, (v) => {
                const result = tan(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, TRIG_TOLERANCE)
              }),
              Match.when({ operation: "sinh" }, (v) => {
                const result = sinh(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, TRIG_TOLERANCE)
              }),
              Match.when({ operation: "cosh" }, (v) => {
                const result = cosh(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, TRIG_TOLERANCE)
              }),
              Match.when({ operation: "tanh" }, (v) => {
                const result = tanh(of(v.input.re, v.input.im))
                expectComplexParity(result.re, result.im, v.expected.re, v.expected.im, TRIG_TOLERANCE)
              }),
              Match.when({ operation: "toPolar" }, (v) => {
                const [r, theta] = toPolar(of(v.input.re, v.input.im))
                expectParity(r, v.expected.r, ARITHMETIC_TOLERANCE)
                expectParity(theta, v.expected.theta, ARITHMETIC_TOLERANCE)
              }),
              Match.when({ operation: "complexDerivative" }, (v) => {
                expectParity(complexDerivative(derivativeFn, v.input.x), v.expected, ARITHMETIC_TOLERANCE)
              }),
              Match.exhaustive
            )
          )
        }))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
