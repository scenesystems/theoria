import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Exit, Number as N, Schema } from "effect"

import { Complex } from "../../src/Complex/model.js"
import {
  abs,
  absWithPolicies,
  add,
  addValidated,
  arg,
  argWithPolicies,
  complexDerivative,
  complexDerivativeValidated,
  complexDerivativeWithPolicies,
  complexDot,
  complexNorm,
  complexScale,
  conjugate,
  cos,
  cosh,
  divide,
  divideValidated,
  exp,
  expValidated,
  fromImaginary,
  fromPolar,
  fromReal,
  fromRealChunk,
  i as iConst,
  log,
  logValidated,
  multiply,
  multiplyValidated,
  of,
  one,
  pow,
  sin,
  sinh,
  sqrt,
  subtract,
  subtractValidated,
  tan,
  tanh,
  toImaginaryChunk,
  toMagnitudeChunk,
  toPhaseChunk,
  toPolar,
  toRealChunk,
  zero
} from "../../src/Complex/operations.js"
import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { dot } from "../../src/LinearAlgebra/operations.js"

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const TOLERANCE = 1e-12

const expectClose = (actual: number, expected: number, tolerance: number = TOLERANCE) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const expectComplexClose = (actual: Complex, expectedRe: number, expectedIm: number, tolerance: number = TOLERANCE) => {
  expectClose(actual.re, expectedRe, tolerance)
  expectClose(actual.im, expectedIm, tolerance)
}

// ---------------------------------------------------------------------------
// Constructors and constants
// ---------------------------------------------------------------------------

describe("Complex / constructors", () => {
  it.effect("of(re, im) constructs Complex", () =>
    Effect.gen(function*() {
      const z = of(3, 4)
      expect(z.re).toStrictEqual(3)
      expect(z.im).toStrictEqual(4)
      expect(z._tag).toStrictEqual("Complex")
    }))

  it.effect("fromReal produces zero imaginary", () =>
    Effect.gen(function*() {
      const z = fromReal(5)
      expect(z.re).toStrictEqual(5)
      expect(z.im).toStrictEqual(0)
    }))

  it.effect("fromImaginary produces zero real", () =>
    Effect.gen(function*() {
      const z = fromImaginary(7)
      expect(z.re).toStrictEqual(0)
      expect(z.im).toStrictEqual(7)
    }))

  it.effect("zero is 0+0i", () =>
    Effect.gen(function*() {
      expect(zero.re).toStrictEqual(0)
      expect(zero.im).toStrictEqual(0)
    }))

  it.effect("one is 1+0i", () =>
    Effect.gen(function*() {
      expect(one.re).toStrictEqual(1)
      expect(one.im).toStrictEqual(0)
    }))

  it.effect("i is 0+1i", () =>
    Effect.gen(function*() {
      expect(iConst.re).toStrictEqual(0)
      expect(iConst.im).toStrictEqual(1)
    }))
})

// ---------------------------------------------------------------------------
// Schema TaggedClass round-trip
// ---------------------------------------------------------------------------

describe("Complex / Schema.TaggedClass", () => {
  it.effect("decodes from { _tag, re, im }", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(Complex)({
        _tag: "Complex",
        re: 1,
        im: 2
      })
      expect(decoded.re).toStrictEqual(1)
      expect(decoded.im).toStrictEqual(2)
    }))

  it.effect("encodes to { _tag, re, im }", () =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(Complex)(new Complex({ re: 3, im: 4 }))
      expect(encoded).toStrictEqual({ _tag: "Complex", re: 3, im: 4 })
    }))

  it.effect("rejects excess properties with onExcessProperty: error", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decodeUnknown(Complex)({
        _tag: "Complex",
        re: 1,
        im: 2,
        extra: "bad"
      }, { onExcessProperty: "error" }).pipe(Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel — arithmetic
// ---------------------------------------------------------------------------

describe("Complex / add", () => {
  it.effect("(1+2i) + (3+4i) = (4+6i)", () =>
    Effect.gen(function*() {
      const result = add(of(1, 2), of(3, 4))
      expectComplexClose(result, 4, 6)
    }))

  it.effect("z + zero = z", () =>
    Effect.gen(function*() {
      const z = of(5, -3)
      expectComplexClose(add(z, zero), 5, -3)
    }))
})

describe("Complex / subtract", () => {
  it.effect("(5+3i) - (2+1i) = (3+2i)", () =>
    Effect.gen(function*() {
      const result = subtract(of(5, 3), of(2, 1))
      expectComplexClose(result, 3, 2)
    }))
})

describe("Complex / multiply", () => {
  it.effect("(1+2i)(3+4i) = (-5+10i)", () =>
    Effect.gen(function*() {
      const result = multiply(of(1, 2), of(3, 4))
      expectComplexClose(result, -5, 10)
    }))

  it.effect("z * one = z", () =>
    Effect.gen(function*() {
      const z = of(7, -2)
      expectComplexClose(multiply(z, one), 7, -2)
    }))

  it.effect("i * i = -1", () =>
    Effect.gen(function*() {
      const result = multiply(iConst, iConst)
      expectComplexClose(result, -1, 0)
    }))
})

describe("Complex / divide", () => {
  it.effect("(1+2i)/(3+4i) = (11/25 + 2/25 i)", () =>
    Effect.gen(function*() {
      const result = divide(of(1, 2), of(3, 4))
      expectComplexClose(result, 0.44, 0.08)
    }))

  it.effect("z / z = 1 (non-zero z)", () =>
    Effect.gen(function*() {
      const z = of(3, 4)
      const result = divide(z, z)
      expectComplexClose(result, 1, 0)
    }))

  it.effect("division by zero gives NaN", () =>
    Effect.gen(function*() {
      const result = divide(of(1, 2), zero)
      expect(Number.isNaN(result.re)).toBe(true)
      expect(Number.isNaN(result.im)).toBe(true)
    }))
})

describe("Complex / conjugate", () => {
  it.effect("conj(3+4i) = 3-4i", () =>
    Effect.gen(function*() {
      expectComplexClose(conjugate(of(3, 4)), 3, -4)
    }))

  it.effect("z * conj(z) = |z|²", () =>
    Effect.gen(function*() {
      const z = of(3, 4)
      const result = multiply(z, conjugate(z))
      expectComplexClose(result, 25, 0)
    }))
})

describe("Complex / abs", () => {
  it.effect("|3+4i| = 5", () =>
    Effect.gen(function*() {
      expectClose(abs(of(3, 4)), 5)
    }))

  it.effect("|0+0i| = 0", () =>
    Effect.gen(function*() {
      expect(abs(zero)).toStrictEqual(0)
    }))
})

describe("Complex / arg", () => {
  it.effect("arg(1+0i) = 0", () =>
    Effect.gen(function*() {
      expectClose(arg(of(1, 0)), 0)
    }))

  it.effect("arg(0+1i) = π/2", () =>
    Effect.gen(function*() {
      expectClose(arg(iConst), N.unsafeDivide(Math.PI, 2))
    }))

  it.effect("arg(-1+0i) = π", () =>
    Effect.gen(function*() {
      expectClose(arg(of(-1, 0)), Math.PI)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel — exp / log / pow / sqrt
// ---------------------------------------------------------------------------

describe("Complex / exp", () => {
  it.effect("exp(0) = 1", () =>
    Effect.gen(function*() {
      expectComplexClose(exp(zero), 1, 0)
    }))

  it.effect("exp(iπ) ≈ -1 (Euler's identity)", () =>
    Effect.gen(function*() {
      const result = exp(of(0, Math.PI))
      expectComplexClose(result, -1, 0, 1e-14)
    }))

  it.effect("exp(1+0i) ≈ e", () =>
    Effect.gen(function*() {
      const result = exp(of(1, 0))
      expectComplexClose(result, Math.E, 0)
    }))
})

describe("Complex / log", () => {
  it.effect("log(1) = 0", () =>
    Effect.gen(function*() {
      expectComplexClose(log(one), 0, 0)
    }))

  it.effect("log(e) ≈ 1", () =>
    Effect.gen(function*() {
      const result = log(of(Math.E, 0))
      expectComplexClose(result, 1, 0)
    }))

  it.effect("log(-1) ≈ iπ", () =>
    Effect.gen(function*() {
      const result = log(of(-1, 0))
      expectComplexClose(result, 0, Math.PI)
    }))

  it.effect("exp(log(z)) ≈ z (round-trip)", () =>
    Effect.gen(function*() {
      const z = of(3, 4)
      const result = exp(log(z))
      expectComplexClose(result, 3, 4, 1e-10)
    }))
})

describe("Complex / pow", () => {
  it.effect("z^0 = 1", () =>
    Effect.gen(function*() {
      expectComplexClose(pow(of(3, 4), zero), 1, 0)
    }))

  it.effect("z^1 ≈ z", () =>
    Effect.gen(function*() {
      const z = of(2, 3)
      const result = pow(z, one)
      expectComplexClose(result, 2, 3, 1e-10)
    }))

  it.effect("(1+i)^2 ≈ 0+2i", () =>
    Effect.gen(function*() {
      const result = pow(of(1, 1), of(2, 0))
      expectComplexClose(result, 0, 2, 1e-10)
    }))
})

describe("Complex / sqrt", () => {
  it.effect("sqrt(4+0i) = 2+0i", () =>
    Effect.gen(function*() {
      expectComplexClose(sqrt(of(4, 0)), 2, 0)
    }))

  it.effect("sqrt(-1) ≈ i", () =>
    Effect.gen(function*() {
      const result = sqrt(of(-1, 0))
      expectComplexClose(result, 0, 1)
    }))

  it.effect("sqrt(0) = 0", () =>
    Effect.gen(function*() {
      expectComplexClose(sqrt(zero), 0, 0)
    }))

  it.effect("sqrt(z)^2 ≈ z (round-trip)", () =>
    Effect.gen(function*() {
      const z = of(3, 4)
      const s = sqrt(z)
      const result = multiply(s, s)
      expectComplexClose(result, 3, 4, 1e-10)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel — polar conversion
// ---------------------------------------------------------------------------

describe("Complex / polar", () => {
  it.effect("toPolar(3+4i) = [5, atan2(4,3)]", () =>
    Effect.gen(function*() {
      const [r, theta] = toPolar(of(3, 4))
      expectClose(r, 5)
      expectClose(theta, Math.atan2(4, 3))
    }))

  it.effect("fromPolar round-trips with toPolar", () =>
    Effect.gen(function*() {
      const z = of(3, 4)
      const [r, theta] = toPolar(z)
      const result = fromPolar(r, theta)
      expectComplexClose(result, 3, 4)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel — trigonometric
// ---------------------------------------------------------------------------

describe("Complex / sin", () => {
  it.effect("sin(0) = 0", () =>
    Effect.gen(function*() {
      expectComplexClose(sin(zero), 0, 0)
    }))

  it.effect("sin(π/2 + 0i) ≈ 1+0i", () =>
    Effect.gen(function*() {
      const result = sin(of(N.unsafeDivide(Math.PI, 2), 0))
      expectComplexClose(result, 1, 0, 1e-14)
    }))

  it.effect("sin(i) = i·sinh(1)", () =>
    Effect.gen(function*() {
      const result = sin(iConst)
      expectComplexClose(result, 0, Math.sinh(1))
    }))
})

describe("Complex / cos", () => {
  it.effect("cos(0) = 1", () =>
    Effect.gen(function*() {
      expectComplexClose(cos(zero), 1, 0)
    }))

  it.effect("cos(π + 0i) ≈ -1+0i", () =>
    Effect.gen(function*() {
      const result = cos(of(Math.PI, 0))
      expectComplexClose(result, -1, 0, 1e-14)
    }))
})

describe("Complex / tan", () => {
  it.effect("tan(0) = 0", () =>
    Effect.gen(function*() {
      expectComplexClose(tan(zero), 0, 0)
    }))

  it.effect("tan(π/4) ≈ 1", () =>
    Effect.gen(function*() {
      const result = tan(of(N.unsafeDivide(Math.PI, 4), 0))
      expectComplexClose(result, 1, 0, 1e-12)
    }))
})

describe("Complex / sinh", () => {
  it.effect("sinh(0) = 0", () =>
    Effect.gen(function*() {
      expectComplexClose(sinh(zero), 0, 0)
    }))

  it.effect("sinh(1+0i) ≈ sinh(1)+0i", () =>
    Effect.gen(function*() {
      const result = sinh(of(1, 0))
      expectComplexClose(result, Math.sinh(1), 0)
    }))
})

describe("Complex / cosh", () => {
  it.effect("cosh(0) = 1", () =>
    Effect.gen(function*() {
      expectComplexClose(cosh(zero), 1, 0)
    }))

  it.effect("cosh(1+0i) ≈ cosh(1)+0i", () =>
    Effect.gen(function*() {
      const result = cosh(of(1, 0))
      expectComplexClose(result, Math.cosh(1), 0)
    }))
})

describe("Complex / tanh", () => {
  it.effect("tanh(0) = 0", () =>
    Effect.gen(function*() {
      expectComplexClose(tanh(zero), 0, 0)
    }))

  it.effect("tanh(1+0i) ≈ tanh(1)", () =>
    Effect.gen(function*() {
      const result = tanh(of(1, 0))
      expectComplexClose(result, Math.tanh(1), 0)
    }))
})

// ---------------------------------------------------------------------------
// Chunk<Complex> carriers
// ---------------------------------------------------------------------------

describe("Complex / complexDot", () => {
  it.effect("dot product of [1+0i, 0+1i] with [1+0i, 0+1i] = 2+0i", () =>
    Effect.gen(function*() {
      const a = Chunk.make(of(1, 0), of(0, 1))
      const b = Chunk.make(of(1, 0), of(0, 1))
      const result = complexDot(a, b)
      expectComplexClose(result, 2, 0)
    }))

  it.effect("dot product uses conjugate on first argument", () =>
    Effect.gen(function*() {
      const a = Chunk.make(of(1, 1))
      const b = Chunk.make(of(1, 1))
      // conj(1+i)·(1+i) = (1-i)(1+i) = 1+1 = 2+0i
      expectComplexClose(complexDot(a, b), 2, 0)
    }))
})

describe("Complex / complexNorm", () => {
  it.effect("norm of [3+4i] = 5", () =>
    Effect.gen(function*() {
      expectClose(complexNorm(Chunk.make(of(3, 4))), 5)
    }))

  it.effect("norm of [1+0i, 0+1i] = √2", () =>
    Effect.gen(function*() {
      expectClose(complexNorm(Chunk.make(of(1, 0), of(0, 1))), Math.sqrt(2))
    }))
})

describe("Complex / complexScale", () => {
  it.effect("scale by 2+0i doubles", () =>
    Effect.gen(function*() {
      const xs = Chunk.make(of(1, 2), of(3, 4))
      const scaled = complexScale(xs, of(2, 0))
      expectComplexClose(Chunk.unsafeGet(scaled, 0), 2, 4)
      expectComplexClose(Chunk.unsafeGet(scaled, 1), 6, 8)
    }))

  it.effect("scale by i rotates 90°", () =>
    Effect.gen(function*() {
      const xs = Chunk.make(of(1, 0))
      const scaled = complexScale(xs, iConst)
      expectComplexClose(Chunk.unsafeGet(scaled, 0), 0, 1)
    }))
})

// ---------------------------------------------------------------------------
// Real ↔ Complex interop
// ---------------------------------------------------------------------------

describe("Complex / real ↔ complex interop", () => {
  it.effect("fromRealChunk lifts reals to complex with im=0", () =>
    Effect.gen(function*() {
      const reals = Chunk.fromIterable([1, 2, 3])
      const result = fromRealChunk(reals)
      expect(Chunk.toReadonlyArray(result).map((z) => [z.re, z.im])).toStrictEqual([
        [1, 0],
        [2, 0],
        [3, 0]
      ])
    }))

  it.effect("toRealChunk extracts real parts", () =>
    Effect.gen(function*() {
      const xs = Chunk.make(of(1, 2), of(3, 4), of(5, 6))
      expect(Chunk.toReadonlyArray(toRealChunk(xs))).toStrictEqual([1, 3, 5])
    }))

  it.effect("toImaginaryChunk extracts imaginary parts", () =>
    Effect.gen(function*() {
      const xs = Chunk.make(of(1, 2), of(3, 4), of(5, 6))
      expect(Chunk.toReadonlyArray(toImaginaryChunk(xs))).toStrictEqual([2, 4, 6])
    }))

  it.effect("toMagnitudeChunk computes |z| for each element", () =>
    Effect.gen(function*() {
      const xs = Chunk.make(of(3, 4), of(0, 1), of(1, 0))
      const result = toMagnitudeChunk(xs)
      expectClose(Chunk.unsafeGet(result, 0), 5)
      expectClose(Chunk.unsafeGet(result, 1), 1)
      expectClose(Chunk.unsafeGet(result, 2), 1)
    }))

  it.effect("toPhaseChunk computes arg(z) for each element", () =>
    Effect.gen(function*() {
      const xs = Chunk.make(of(1, 0), of(0, 1), of(-1, 0))
      const result = toPhaseChunk(xs)
      expectClose(Chunk.unsafeGet(result, 0), 0)
      expectClose(Chunk.unsafeGet(result, 1), N.unsafeDivide(Math.PI, 2))
      expectClose(Chunk.unsafeGet(result, 2), Math.PI)
    }))

  it.effect("round-trip: toRealChunk(fromRealChunk(xs)) = xs", () =>
    Effect.gen(function*() {
      const reals = Chunk.fromIterable([1, 2, 3])
      expect(Chunk.toReadonlyArray(toRealChunk(fromRealChunk(reals)))).toStrictEqual([1, 2, 3])
    }))

  it.effect("toRealChunk output feeds LinearAlgebra.dot", () =>
    Effect.gen(function*() {
      const a = Chunk.make(of(1, 10), of(2, 20), of(3, 30))
      const b = Chunk.make(of(4, 40), of(5, 50), of(6, 60))
      const result = dot(toRealChunk(a), toRealChunk(b))
      // 1·4 + 2·5 + 3·6 = 32
      expect(result).toStrictEqual(32)
    }))
})

// ---------------------------------------------------------------------------
// Complex-step differentiation
// ---------------------------------------------------------------------------

describe("Complex / complexDerivative (complex-step method)", () => {
  it.effect("derivative of z→z² at x=3 ≈ 6", () =>
    Effect.gen(function*() {
      const f = (z: Complex) => multiply(z, z)
      expectClose(complexDerivative(f, 3), 6, 1e-15)
    }))

  it.effect("derivative of exp at x=0 ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(complexDerivative(exp, 0), 1, 1e-15)
    }))

  it.effect("derivative of sin at x=0 ≈ cos(0) = 1", () =>
    Effect.gen(function*() {
      expectClose(complexDerivative(sin, 0), 1, 1e-15)
    }))

  it.effect("derivative of cos at x=0 ≈ -sin(0) = 0", () =>
    Effect.gen(function*() {
      expectClose(complexDerivative(cos, 0), 0, 1e-15)
    }))

  it.effect("derivative of z→z³ at x=2 ≈ 12", () =>
    Effect.gen(function*() {
      const f = (z: Complex) => multiply(z, multiply(z, z))
      expectClose(complexDerivative(f, 2), 12, 1e-14)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Complex / addValidated", () => {
  it.effect("accepts valid binary input", () =>
    Effect.gen(function*() {
      const result = yield* addValidated({ aRe: 1, aIm: 2, bRe: 3, bIm: 4 })
      expectComplexClose(result, 4, 6)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* addValidated({ aRe: 1, aIm: 2, bRe: 3, bIm: 4, extra: "bad" }).pipe(
        Effect.exit
      )
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Complex / subtractValidated", () => {
  it.effect("accepts valid binary input", () =>
    Effect.gen(function*() {
      const result = yield* subtractValidated({ aRe: 5, aIm: 3, bRe: 2, bIm: 1 })
      expectComplexClose(result, 3, 2)
    }))
})

describe("Complex / multiplyValidated", () => {
  it.effect("accepts valid binary input", () =>
    Effect.gen(function*() {
      const result = yield* multiplyValidated({ aRe: 1, aIm: 2, bRe: 3, bIm: 4 })
      expectComplexClose(result, -5, 10)
    }))
})

describe("Complex / divideValidated", () => {
  it.effect("accepts valid binary input", () =>
    Effect.gen(function*() {
      const result = yield* divideValidated({ aRe: 1, aIm: 2, bRe: 3, bIm: 4 })
      expectComplexClose(result, 0.44, 0.08)
    }))
})

describe("Complex / expValidated", () => {
  it.effect("accepts valid unary input", () =>
    Effect.gen(function*() {
      const result = yield* expValidated({ re: 0, im: 0 })
      expectComplexClose(result, 1, 0)
    }))
})

describe("Complex / logValidated", () => {
  it.effect("accepts valid unary input", () =>
    Effect.gen(function*() {
      const result = yield* logValidated({ re: 1, im: 0 })
      expectComplexClose(result, 0, 0)
    }))
})

describe("Complex / complexDerivativeValidated", () => {
  it.effect("accepts valid step input", () =>
    Effect.gen(function*() {
      const f = (z: Complex) => multiply(z, z)
      const result = yield* complexDerivativeValidated(f, { x: 3 })
      expectClose(result, 6, 1e-15)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Complex / absWithPolicies", () => {
  it.effect("strict policy passes for finite input", () =>
    Effect.gen(function*() {
      const result = yield* absWithPolicies(of(3, 4))
      expectClose(result, 5)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed policy passes for any input", () =>
    Effect.gen(function*() {
      const result = yield* absWithPolicies(of(3, 4))
      expectClose(result, 5)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Complex / argWithPolicies", () => {
  it.effect("strict policy passes for finite input", () =>
    Effect.gen(function*() {
      const result = yield* argWithPolicies(of(1, 1))
      expectClose(result, N.unsafeDivide(Math.PI, 4))
    }).pipe(Effect.provide(strictTypedArrayLayer)))
})

describe("Complex / complexDerivativeWithPolicies", () => {
  it.effect("strict policy passes for analytic function", () =>
    Effect.gen(function*() {
      const f = (z: Complex) => multiply(z, z)
      const result = yield* complexDerivativeWithPolicies(f, 3)
      expectClose(result, 6, 1e-15)
    }).pipe(Effect.provide(strictTypedArrayLayer)))
})
