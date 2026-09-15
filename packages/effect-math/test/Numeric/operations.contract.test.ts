import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Number as EffectNumber, Option, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  abs,
  argmaxIndex,
  argmaxValidated,
  between,
  ceil,
  clamp,
  cos,
  expm1,
  expm1Strict,
  expm1WithPolicies,
  floor,
  isFinite,
  log,
  log10,
  log1p,
  log1pStrict,
  log1pWithPolicies,
  logStrict,
  logValidated,
  max,
  min,
  pi,
  pow,
  round,
  safeDivide,
  safeDivideFinite,
  safeDivideValidated,
  sin,
  sqrt,
  sum,
  sumValidated,
  sumWithPolicies,
  truncate,
  unsafeDivide,
  unsafeDivideValidated
} from "../../src/Numeric/operations.js"

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const E = 2.718281828459045
const LN2 = 0.6931471805599453
const MIN_SUBNORMAL = 5e-324
const MAX_FINITE = 1.7976931348623157e308
const isFiniteNumber = Schema.is(Schema.Finite)

describe("Numeric / safeDivide", () => {
  it.effect("returns Some for valid division", () =>
    Effect.gen(function*() {
      const result = yield* safeDivide(10, 3)
      expect(result).toBeCloseTo(3.3333333333333335)
    }))

  it.effect("returns None for zero divisor", () =>
    Effect.gen(function*() {
      expect(Option.isNone(safeDivide(10, 0))).toStrictEqual(true)
    }))

  it.effect("supports dual API", () =>
    Effect.gen(function*() {
      const divideByTwo = safeDivide(2)
      expect(yield* divideByTwo(10)).toStrictEqual(5)
    }))
})

describe("Numeric / unsafeDivide", () => {
  it.effect("returns result for valid division", () =>
    Effect.gen(function*() {
      expect(unsafeDivide(10, 2)).toStrictEqual(5)
    }))

  it.effect("supports dual API", () =>
    Effect.gen(function*() {
      expect(unsafeDivide(4)(20)).toStrictEqual(5)
    }))
})

describe("Numeric / safeDivideFinite", () => {
  it.effect("returns None when dividend is Infinity", () =>
    Effect.gen(function*() {
      expect(Option.isNone(safeDivideFinite(Infinity, 2))).toStrictEqual(true)
    }))

  it.effect("returns None when divisor is NaN", () =>
    Effect.gen(function*() {
      expect(Option.isNone(safeDivideFinite(1, NaN))).toStrictEqual(true)
    }))

  it.effect("returns Some for valid finite division", () =>
    Effect.gen(function*() {
      expect(yield* safeDivideFinite(10, 4)).toStrictEqual(2.5)
    }))

  it.effect("returns None when finite operands overflow", () =>
    Effect.gen(function*() {
      expect(Option.isNone(safeDivideFinite(MAX_FINITE, MIN_SUBNORMAL))).toStrictEqual(true)
    }))
})

describe("Numeric / scalar boundaries", () => {
  it.effect("identifies finite values", () =>
    Effect.gen(function*() {
      expect(isFinite(EffectNumber.negate(1.25))).toStrictEqual(true)
      expect(isFinite(Infinity)).toStrictEqual(false)
      expect(isFinite(EffectNumber.negate(Infinity))).toStrictEqual(false)
      expect(isFinite(NaN)).toStrictEqual(false)
    }))

  it.effect("selects pairwise extrema", () =>
    Effect.gen(function*() {
      expect(min(2, 3)).toStrictEqual(2)
      expect(max(2, 3)).toStrictEqual(3)
      expect(min(3)(2)).toStrictEqual(2)
      expect(max(3)(2)).toStrictEqual(3)
    }))

  it.effect("computes magnitudes across IEEE 754 boundaries", () =>
    Effect.gen(function*() {
      expect(abs(EffectNumber.negate(2.5))).toBe(2.5)
      expect(abs(0)).toBe(0)
      expect(abs(EffectNumber.negate(0))).toBe(0)
      expect(abs(Infinity)).toBe(Infinity)
      expect(abs(EffectNumber.negate(Infinity))).toBe(Infinity)
      expect(abs(NaN)).toBeNaN()
      expect(abs(MIN_SUBNORMAL)).toBe(MIN_SUBNORMAL)
      expect(abs(EffectNumber.negate(MIN_SUBNORMAL))).toBe(MIN_SUBNORMAL)
      expect(abs(MAX_FINITE)).toBe(MAX_FINITE)
      expect(abs(EffectNumber.negate(MAX_FINITE))).toBe(MAX_FINITE)
    }))

  it.effect("computes square roots", () =>
    Effect.gen(function*() {
      expect(sqrt(9)).toStrictEqual(3)
      expect(sqrt(EffectNumber.negate(1))).toBeNaN()
    }))

  it.effect("computes scalar trigonometry, powers, logarithms, and precision rounding", () =>
    Effect.gen(function*() {
      expect(sin(EffectNumber.unsafeDivide(pi, 2))).toBeCloseTo(1)
      expect(cos(pi)).toBeCloseTo(EffectNumber.negate(1))
      expect(log10(1_000)).toStrictEqual(3)
      expect(pow(3, 4)).toStrictEqual(81)
      expect(round(1.2345, 2)).toStrictEqual(1.23)
      expect(round(2)(1.235)).toStrictEqual(1.24)
    }))

  it.effect("rounds to integer boundaries", () =>
    Effect.gen(function*() {
      expect(floor(2.75)).toStrictEqual(2)
      expect(floor(EffectNumber.negate(2.25))).toStrictEqual(EffectNumber.negate(3))
      expect(ceil(2.25)).toStrictEqual(3)
      expect(ceil(EffectNumber.negate(2.75))).toStrictEqual(EffectNumber.negate(2))
      expect(truncate(2.75)).toStrictEqual(2)
      expect(truncate(EffectNumber.negate(2.75))).toStrictEqual(EffectNumber.negate(2))
    }))

  it.effect("retains non-finite values at integer boundaries", () =>
    Effect.gen(function*() {
      expect(floor(Infinity)).toStrictEqual(Infinity)
      expect(ceil(EffectNumber.negate(Infinity))).toStrictEqual(EffectNumber.negate(Infinity))
      expect(truncate(NaN)).toBeNaN()
    }))
})

describe("Numeric / sum", () => {
  it.effect("sums an array", () =>
    Effect.gen(function*() {
      expect(sum(Arr.make(1, 2, 3, 4, 5))).toStrictEqual(15)
    }))

  it.effect("returns 0 for empty iterable", () =>
    Effect.gen(function*() {
      expect(sum(Arr.empty<number>())).toStrictEqual(0)
    }))

  it.effect("accumulates in order without compensation", () =>
    Effect.gen(function*() {
      const values = Arr.make(1e16, 1, 1, EffectNumber.negate(1e16))
      expect(sum(values)).toBe(0)
    }))
})

describe("Numeric / argmaxIndex", () => {
  it.effect("returns index of maximum element", () =>
    Effect.gen(function*() {
      expect(yield* argmaxIndex(Chunk.make(1, 5, 3, 2))).toStrictEqual(1)
    }))

  it.effect("returns None for an empty chunk", () =>
    Effect.gen(function*() {
      expect(Option.isNone(argmaxIndex(Chunk.empty<number>()))).toStrictEqual(true)
    }))

  it.effect("returns first index on ties", () =>
    Effect.gen(function*() {
      expect(yield* argmaxIndex(Chunk.make(5, 5, 5))).toStrictEqual(0)
    }))

  it.effect("handles single element", () =>
    Effect.gen(function*() {
      expect(yield* argmaxIndex(Chunk.make(42))).toStrictEqual(0)
    }))

  it.effect("orders a leading NaN below later finite candidates", () =>
    Effect.gen(function*() {
      expect(yield* argmaxIndex(Chunk.make(NaN, 5, 10))).toStrictEqual(2)
    }))

  it.effect("ignores a later NaN while selecting ordered values", () =>
    Effect.gen(function*() {
      expect(yield* argmaxIndex(Chunk.make(5, NaN, 10))).toStrictEqual(2)
      expect(yield* argmaxIndex(Chunk.make(5, NaN, 1))).toStrictEqual(0)
      expect(yield* argmaxIndex(Chunk.make(5, 1, NaN))).toStrictEqual(0)
      expect(yield* argmaxIndex(Chunk.make(NaN, NaN))).toStrictEqual(0)
    }))
})

describe("Numeric / clamp", () => {
  it.effect("clamps below minimum", () =>
    Effect.gen(function*() {
      expect(clamp(EffectNumber.negate(5), { minimum: 0, maximum: 10 })).toStrictEqual(0)
    }))

  it.effect("clamps above maximum", () =>
    Effect.gen(function*() {
      expect(clamp(15, { minimum: 0, maximum: 10 })).toStrictEqual(10)
    }))

  it.effect("passes through values within range", () =>
    Effect.gen(function*() {
      expect(clamp(5, { minimum: 0, maximum: 10 })).toStrictEqual(5)
    }))
})

describe("Numeric / between", () => {
  it.effect("returns true for value in range", () =>
    Effect.gen(function*() {
      expect(between(5, { minimum: 0, maximum: 10 })).toStrictEqual(true)
    }))

  it.effect("returns false for value outside range", () =>
    Effect.gen(function*() {
      expect(between(15, { minimum: 0, maximum: 10 })).toStrictEqual(false)
    }))
})

describe("Numeric / log", () => {
  it.effect("computes natural logarithm", () =>
    Effect.gen(function*() {
      expect(log(E)).toBeCloseTo(1)
    }))

  it.effect("strict logarithm covers subnormal, exponent, and domain boundaries", () =>
    Effect.gen(function*() {
      expect(logStrict(1)).toBe(0)
      expect(logStrict(2)).toBe(LN2)
      expect(logStrict(MIN_SUBNORMAL)).toBeCloseTo(-744.4400719213812, 12)
      expect(logStrict(MAX_FINITE)).toBeCloseTo(709.782712893384, 12)
      expect(logStrict(0)).toBe(EffectNumber.negate(Infinity))
      expect(logStrict(EffectNumber.negate(0))).toBe(EffectNumber.negate(Infinity))
      expect(logStrict(Infinity)).toBe(Infinity)
      expect(logStrict(-1)).toBeNaN()
      expect(logStrict(NaN)).toBeNaN()
    }))
})

describe("Numeric / log1p", () => {
  it.effect("is numerically stable near zero", () =>
    Effect.gen(function*() {
      const tiny = 1e-15
      expect(isFiniteNumber(log1p(tiny))).toStrictEqual(true)
      expect(log1p(tiny)).not.toStrictEqual(0)
    }))
})

describe("Numeric / expm1", () => {
  it.effect("is numerically stable near zero", () =>
    Effect.gen(function*() {
      const tiny = 1e-15
      expect(isFiniteNumber(expm1(tiny))).toStrictEqual(true)
      expect(expm1(tiny)).not.toStrictEqual(0)
    }))

  it.effect("strict increment kernels retain signed zero and enforce their domains", () =>
    Effect.gen(function*() {
      const negativeZero = EffectNumber.negate(0)
      expect(log1pStrict(negativeZero)).toBe(negativeZero)
      expect(expm1Strict(negativeZero)).toBe(negativeZero)
      expect(log1pStrict(-1)).toBe(EffectNumber.negate(Infinity))
      expect(log1pStrict(-2)).toBeNaN()
      expect(log1pStrict(NaN)).toBeNaN()
      expect(log1pStrict(Infinity)).toBe(Infinity)
      expect(expm1Strict(EffectNumber.negate(Infinity))).toBe(-1)
      expect(expm1Strict(NaN)).toBeNaN()
      expect(expm1Strict(Infinity)).toBe(Infinity)
    }))
})

describe("Numeric / safeDivideValidated", () => {
  it.effect("decodes valid input and returns Option.Some", () =>
    Effect.gen(function*() {
      const result = yield* yield* safeDivideValidated({ dividend: 10, divisor: 4 })
      expect(result).toStrictEqual(2.5)
    }))

  it.effect("rejects excess properties with NumericDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        safeDivideValidated({ dividend: 10, divisor: 4, extra: true })
      )
      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("safeDivide")
    }))

  it.effect("rejects non-finite input with NumericDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        safeDivideValidated({ dividend: Infinity, divisor: 2 })
      )
      expect(error._tag).toStrictEqual("NumericDecodeError")
    }))
})

describe("Numeric / unsafeDivideValidated", () => {
  it.effect("succeeds for valid division", () =>
    Effect.gen(function*() {
      expect(yield* unsafeDivideValidated({ dividend: 10, divisor: 5 })).toStrictEqual(2)
    }))

  it.effect("fails with NumericDomainViolationError on zero divisor", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        unsafeDivideValidated({ dividend: 10, divisor: 0 })
      )
      expect(error._tag).toStrictEqual("NumericDomainViolationError")
      expect(error.operation).toStrictEqual("unsafeDivide")
    }))
})

describe("Numeric / logValidated", () => {
  it.effect("succeeds for positive finite input", () =>
    Effect.gen(function*() {
      expect(yield* logValidated({ value: E })).toBeCloseTo(1)
    }))

  it.effect("rejects non-positive input", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(logValidated({ value: EffectNumber.negate(1) }))
      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("log")
    }))
})

describe("Numeric / sumValidated", () => {
  it.effect("sums a non-empty finite vector", () =>
    Effect.gen(function*() {
      expect(yield* sumValidated({ values: Arr.make(1, 2, 3) })).toStrictEqual(6)
    }))

  it.effect("rejects empty array", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(sumValidated({ values: Arr.empty<number>() }))
      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("sum")
    }))
})

describe("Numeric / argmaxValidated", () => {
  it.effect("returns index of maximum in non-empty vector", () =>
    Effect.gen(function*() {
      expect(yield* yield* argmaxValidated({ values: Arr.make(1, 5, 3) })).toStrictEqual(1)
    }))

  it.effect("rejects NaN in vector", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(argmaxValidated({ values: Arr.make(1, NaN, 3) }))
      expect(error._tag).toStrictEqual("NumericDecodeError")
    }))
})

describe("Numeric / sumWithPolicies", () => {
  it.effect("typed-array backend recovers low-order terms with compensation", () =>
    Effect.gen(function*() {
      const values = Chunk.make(1e16, 1, 1, EffectNumber.negate(1e16))
      const result = yield* sumWithPolicies(values)
      expect(isFiniteNumber(result)).toStrictEqual(true)
      expect(result).toBe(2)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("scalar backend exposes uncompensated cancellation", () =>
    Effect.gen(function*() {
      const values = Chunk.make(1e16, 1, 1, EffectNumber.negate(1e16))
      const result = yield* sumWithPolicies(values)
      expect(isFiniteNumber(result)).toStrictEqual(true)
      expect(result).toBe(0)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict precision rejects non-finite sum", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(sumWithPolicies(Chunk.make(Infinity, 1, 2)))
      expect(error._tag).toStrictEqual("NumericDomainViolationError")
      expect(error.operation).toStrictEqual("sumWithPolicies")
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed precision allows non-finite sum", () =>
    Effect.gen(function*() {
      expect(yield* sumWithPolicies(Chunk.make(Infinity, 1, 2))).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("both backends preserve an exactly representable finite total", () =>
    Effect.gen(function*() {
      const values = Chunk.make(0.25, 0.5, 0.75)
      const typedArrayResult = yield* sumWithPolicies(values).pipe(
        Effect.provide(strictTypedArrayLayer)
      )
      const scalarResult = yield* sumWithPolicies(values).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(typedArrayResult).toBe(1.5)
      expect(scalarResult).toBe(1.5)
    }))

  it.effect("both backends retain a trailing low-order term after cancellation", () =>
    Effect.gen(function*() {
      const values = Chunk.make(1e16, EffectNumber.negate(1e16), 1)
      const typedArrayResult = yield* sumWithPolicies(values).pipe(
        Effect.provide(strictTypedArrayLayer)
      )
      const scalarResult = yield* sumWithPolicies(values).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(typedArrayResult).toBe(1)
      expect(scalarResult).toBe(1)
    }))
})

describe("Numeric / log1pWithPolicies", () => {
  it.effect("strict precision preserves accuracy for small x", () =>
    Effect.gen(function*() {
      const smallX = 1e-10
      const result = yield* log1pWithPolicies(smallX)
      expect(isFiniteNumber(result)).toStrictEqual(true)
      expect(result).not.toStrictEqual(0)
      expect(result).toBeCloseTo(smallX, 15)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed precision computes ln(2) for x=1", () =>
    Effect.gen(function*() {
      expect(yield* log1pWithPolicies(1.0)).toBeCloseTo(LN2)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict and relaxed converge for large x", () =>
    Effect.gen(function*() {
      const largeX = 100.0
      const strictResult = yield* log1pWithPolicies(largeX).pipe(Effect.provide(strictTypedArrayLayer))
      const relaxedResult = yield* log1pWithPolicies(largeX).pipe(Effect.provide(relaxedScalarLayer))
      expect(strictResult).toBeCloseTo(relaxedResult)
    }))
})

describe("Numeric / expm1WithPolicies", () => {
  it.effect("strict precision preserves accuracy for small x", () =>
    Effect.gen(function*() {
      const smallX = 1e-10
      const result = yield* expm1WithPolicies(smallX)
      expect(isFiniteNumber(result)).toStrictEqual(true)
      expect(result).not.toStrictEqual(0)
      expect(result).toBeCloseTo(smallX, 15)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("strict and relaxed converge for large x", () =>
    Effect.gen(function*() {
      const largeX = 10.0
      const strictResult = yield* expm1WithPolicies(largeX).pipe(Effect.provide(strictTypedArrayLayer))
      const relaxedResult = yield* expm1WithPolicies(largeX).pipe(Effect.provide(relaxedScalarLayer))
      expect(strictResult).toBeCloseTo(relaxedResult)
    }))
})
