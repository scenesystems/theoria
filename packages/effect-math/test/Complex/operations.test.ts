import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"

import * as Complex from "../../src/Complex.js"
import * as Numeric from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"

const strict = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "disabled"
})

const expectClose = (actual: number, expected: number, tolerance: number = 1e-12) =>
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const expectComplex = (actual: Complex.Complex, re: number, im: number, tolerance: number = 1e-12) => {
  expectClose(actual.re, re, tolerance)
  expectClose(actual.im, im, tolerance)
}

describe("Complex arithmetic", () => {
  it.effect("supports data-first and data-last binary combinators", () =>
    Effect.gen(function*() {
      const self = Complex.make(1, 2)
      const that = Complex.make(3, 4)
      expectComplex(Complex.add(self, that), 4, 6)
      expectComplex(Complex.add(that)(self), 4, 6)
      expectComplex(Complex.subtract(self, that), -2, -2)
      expectComplex(Complex.subtract(that)(self), -2, -2)
      expectComplex(Complex.multiply(self, that), -5, 10)
      expectComplex(Complex.divide(self, that), 0.44, 0.08)
      expectComplex(Complex.divide(that)(self), 0.44, 0.08)
    }))

  it.effect("preserves principal branches and Euler's identity", () =>
    Effect.gen(function*() {
      expectComplex(Complex.exp(Complex.make(0, Numeric.pi)), -1, 0, 1e-14)
      expectComplex(Complex.log(Complex.make(-1, 0)), 0, Numeric.pi)
      expectComplex(Complex.sqrt(Complex.make(-1, 0)), 0, 1)
      expectComplex(Complex.pow(Complex.make(1, 1), Complex.make(2, 0)), 0, 2, 1e-10)
    }))

  it.effect("round-trips Cartesian values through honest polar coordinates", () =>
    Effect.gen(function*() {
      const [radius, angle] = Complex.toPolar(Complex.make(3, 4))
      expectClose(radius, 5)
      expectComplex(Complex.fromPolar(radius, angle), 3, 4)
    }))

  it.effect("extends trigonometric identities to complex arguments", () =>
    Effect.gen(function*() {
      expectComplex(Complex.sin(Complex.i), 0, Numeric.sinh(1))
      expectComplex(Complex.cos(Complex.zero), 1, 0)
      expectComplex(Complex.tan(Complex.make(Number.unsafeDivide(Numeric.pi, 4), 0)), 1, 0)
      expectComplex(Complex.tanh(Complex.make(1, 0)), Number.unsafeDivide(Numeric.sinh(1), Numeric.cosh(1)), 0)
    }))
})

describe("Complex vectors", () => {
  it.effect("uses a conjugate-linear first operand for dot", () =>
    Effect.gen(function*() {
      const values = Chunk.make(Complex.make(1, 1), Complex.make(0, 1))
      expectComplex(Complex.dot(values, values), 3, 0)
      expectClose(Complex.norm(Chunk.make(Complex.make(3, 4))), 5)
    }))

  it.effect("scales vectors and projects their components", () =>
    Effect.gen(function*() {
      const values = Chunk.make(Complex.make(1, 2), Complex.make(3, 4))
      const scaled = Complex.scale(Complex.i)(values)
      expectComplex(Chunk.unsafeGet(scaled, 0), -2, 1)
      expect(Complex.toRealChunk(values)).toStrictEqual(Chunk.make(1, 3))
      expect(Complex.toImaginaryChunk(values)).toStrictEqual(Chunk.make(2, 4))
      expect(Complex.toMagnitudeChunk(values)).toStrictEqual(Chunk.make(Numeric.sqrt(5), 5))
    }))
})

describe("Complex validation and policies", () => {
  it.effect("round-trips the canonical Schema class", () =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(Complex.Complex)(Complex.make(3, 4))
      const decoded = yield* Schema.decode(Complex.Complex)(encoded)
      expectComplex(decoded, 3, 4)
    }))

  it.effect("rejects excess validated input with the stable wire tag", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(Complex.addValidated({
        aRe: 1,
        aIm: 2,
        bRe: 3,
        bIm: 4,
        extra: true
      }))
      expect(error._tag).toStrictEqual("ComplexDecodeError")
      expect(error.operation).toStrictEqual("add")
    }))

  it.effect("applies strict precision to finite scalar results", () =>
    Effect.gen(function*() {
      expectClose(yield* Complex.absWithPolicies(Complex.make(3, 4)), 5)
      expectClose(yield* Complex.argWithPolicies(Complex.make(1, 1)), Number.unsafeDivide(Numeric.pi, 4))
    }).pipe(Effect.provide(strict)))
})
