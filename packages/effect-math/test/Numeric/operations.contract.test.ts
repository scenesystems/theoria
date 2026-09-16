import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, FastCheck, Iterable, Number, Option, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import {
  BackendPolicyService,
  makeDeterministicRuntimePoliciesLayer
} from "../../src/contracts/shared/RuntimePolicies.js"
import { NumericDecodeError, NumericDomainViolationError } from "../../src/Numeric/errors.js"
import {
  abs,
  argmaxIndex,
  argmaxValidated,
  atan2,
  between,
  ceil,
  clamp,
  cos,
  cosh,
  exp,
  expm1,
  expm1WithPolicies,
  floor,
  isFinite,
  log,
  log10,
  log1p,
  log1pWithPolicies,
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
  sinh,
  sqrt,
  sum,
  sumValidated,
  sumWithPolicies,
  truncate,
  unsafeDivide,
  unsafeDivideValidated
} from "../../src/Numeric/operations.js"

const strictLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const closeTo = (actual: number, expected: number, tolerance: number) =>
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Numeric scalar arithmetic", () => {
  it.effect("distinguishes guarded, unguarded, and finite division boundaries", () =>
    Effect.gen(function*() {
      expect(yield* safeDivide(10, 4)).toBe(2.5)
      expect(yield* safeDivide(4)(10)).toBe(2.5)
      expect(Option.isNone(safeDivide(10, 0))).toBe(true)
      expect(unsafeDivide(10, 4)).toBe(2.5)
      expect(unsafeDivide(4)(10)).toBe(2.5)
      expect(Option.isNone(safeDivideFinite(Number.unsafeDivide(1, 0), 2))).toBe(true)
      expect(Option.isNone(safeDivideFinite(1, Number.unsafeDivide(0, 0)))).toBe(true)
    }))

  it.effect("selects extrema, ranges, and decimal rounding through Effect Number", () =>
    Effect.gen(function*() {
      expect(min(3, 2)).toBe(2)
      expect(max(3)(2)).toBe(3)
      expect(clamp(-5, { minimum: 0, maximum: 10 })).toBe(0)
      expect(between(5, { minimum: 0, maximum: 10 })).toBe(true)
      expect(between(15, { minimum: 0, maximum: 10 })).toBe(false)
      expect(round(1.2345, 2)).toBe(1.23)
      expect(round(2)(1.235)).toBe(1.24)
    }))

  it.effect("preserves IEEE signs and exceptional values at scalar boundaries", () =>
    Effect.gen(function*() {
      const infinity = Number.unsafeDivide(1, 0)
      const nan = Number.unsafeDivide(0, 0)
      expect(isFinite(-1.25)).toBe(true)
      expect(isFinite(infinity)).toBe(false)
      expect(abs(-0)).toBe(0)
      expect(sqrt(-0)).toBe(-0)
      expect(sqrt(-1)).toBeNaN()
      expect(floor(-0.25)).toBe(-1)
      expect(ceil(-0.25)).toBe(-0)
      expect(truncate(-0.25)).toBe(-0)
      expect(truncate(nan)).toBeNaN()
    }))
})

describe("Numeric transcendental kernels", () => {
  it.effect("matches independent golden values across the logarithm and exponential ranges", () =>
    Effect.gen(function*() {
      expect(log(1)).toBe(0)
      expect(log10(1_000)).toBe(3)
      closeTo(log(10), 2.302585092994046, 5e-16)
      expect(exp(1)).toBe(2.718281828459045)
      expect(exp(50)).toBe(5.184705528587072e21)
      expect(exp(-745)).toBe(5e-324)
      expect(exp(-746)).toBe(0)
      expect(exp(710)).toBe(Number.unsafeDivide(1, 0))
    }))

  it.effect("retains increments smaller than one ulp around unity", () =>
    Effect.gen(function*() {
      expect(log1p(1e-15)).toBe(9.999999999999995e-16)
      expect(log1p(-1e-15)).toBe(-1.0000000000000007e-15)
      expect(expm1(1e-15)).toBe(1.0000000000000007e-15)
      expect(expm1(-1e-15)).toBe(-9.999999999999995e-16)
      expect(log1p(-0)).toBe(-0)
      expect(expm1(-0)).toBe(-0)
      expect(log1p(-1)).toBe(Number.unsafeDivide(-1, 0))
      expect(log1p(-2)).toBeNaN()
    }))

  it.effect("reduces ordinary and huge angles without losing the quadrant", () =>
    Effect.gen(function*() {
      closeTo(sin(Number.unsafeDivide(pi, 6)), 0.5, 1e-15)
      closeTo(cos(Number.unsafeDivide(pi, 3)), 0.5, 1e-15)
      closeTo(sin(1e20), -0.6452512852657808, 2e-15)
      closeTo(cos(1e100), 0.9247242387519338, 2e-15)
      closeTo(sin(1.7976931348623157e308), 0.004961954789184062, 3e-15)
      expect(sin(-0)).toBe(-0)
      expect(cos(Number.unsafeDivide(1, 0))).toBeNaN()
    }))

  it.effect("retains the residual of binary64 angles near exact quadrant boundaries", () =>
    Effect.gen(function*() {
      // Rounded high-precision evaluations at these exact binary64 inputs.
      closeTo(sin(pi), 1.2246467991473532e-16, 3e-32)
      closeTo(sin(Number.multiply(2, pi)), -2.4492935982947064e-16, 5e-32)
      closeTo(cos(Number.unsafeDivide(pi, 2)), 6.123233995736766e-17, 2e-32)
      closeTo(sin(3.1415926535897936), -3.216245299353273e-16, 5e-32)
      closeTo(cos(1.5707963267948968), -1.6081226496766366e-16, 3e-32)
    }))

  it.effect("handles atan2 quadrants, signed zero, and infinite coordinates", () =>
    Effect.gen(function*() {
      closeTo(atan2(1, 1), 0.7853981633974483, 1e-15)
      closeTo(atan2(1, -1), 2.356194490192345, 1e-15)
      expect(atan2(-0, -1)).toBe(-3.141592653589793)
      expect(atan2(-0, 1)).toBe(-0)
      expect(atan2(Number.unsafeDivide(1, 0), Number.unsafeDivide(1, 0))).toBe(0.7853981633974483)
    }))

  it.effect("computes real powers and hyperbolic functions at domain boundaries", () =>
    Effect.gen(function*() {
      expect(pow(-2, 3)).toBe(-8)
      expect(pow(-2, 4)).toBe(16)
      expect(pow(-2, 0.5)).toBeNaN()
      closeTo(pow(2, 0.5), 1.4142135623730951, 5e-16)
      closeTo(sinh(1), 1.1752011936438014, 5e-16)
      closeTo(cosh(1), 1.5430806348152437, 5e-16)
      expect(sinh(-0)).toBe(-0)
      expect(cosh(Number.unsafeDivide(-1, 0))).toBe(Number.unsafeDivide(1, 0))
    }))

  it.effect("preserves exceptional powers and gradual underflow", () =>
    Effect.gen(function*() {
      const infinity = Number.unsafeDivide(1, 0)
      const nan = Number.unsafeDivide(0, 0)
      expect(pow(nan, 0)).toBe(1)
      expect(pow(1, nan)).toBeNaN()
      expect(pow(1, infinity)).toBeNaN()
      expect(pow(-1, Number.negate(infinity))).toBeNaN()
      expect(pow(2, -1024)).toBe(5.562684646268003e-309)
      expect(pow(2, -1074)).toBe(5e-324)
      expect(pow(-2, -1073)).toBe(-1e-323)
      expect(pow(2, -1075)).toBe(0)
    }))

  it.effect("rescales hyperbolic exponentials before rounding to binary64", () =>
    Effect.gen(function*() {
      // exp(710) overflows, but exp(710)/2 is still representable.
      closeTo(sinh(710), 1.1169973830808555e308, 2e292)
      closeTo(cosh(-710), 1.1169973830808555e308, 2e292)
      expect(sinh(711)).toBe(Number.unsafeDivide(1, 0))
      expect(cosh(711)).toBe(Number.unsafeDivide(1, 0))
    }))

  it.effect.prop("computes exact small non-negative integer powers", {
    base: FastCheck.integer({ min: -12, max: 12 }),
    exponent: FastCheck.integer({ min: 0, max: 8 })
  }, ({ base, exponent }) =>
    Effect.gen(function*() {
      const expected = Number.multiplyAll(Iterable.take(Iterable.makeBy(() => base), exponent))
      expect(pow(base, exponent)).toBe(expected)
    }))
})

describe("Numeric collection kernels", () => {
  it.effect("sums any native iterable and retains the empty identity", () =>
    Effect.gen(function*() {
      expect(sum(Chunk.make(1, 2, 3, 4, 5))).toBe(15)
      expect(sum(Chunk.empty())).toBe(0)
    }))

  it.effect("finds the first maximum without requiring an array carrier", () =>
    Effect.gen(function*() {
      expect(yield* argmaxIndex(Chunk.make(1, 5, 5, 2))).toBe(1)
      expect(yield* argmaxIndex(Chunk.of(42))).toBe(0)
      expect(Option.isNone(argmaxIndex(Chunk.empty()))).toBe(true)
    }))
})

describe("Numeric validated boundaries", () => {
  it.effect("decodes valid division, logarithm, reduction, and selection inputs", () =>
    Effect.gen(function*() {
      expect(yield* yield* safeDivideValidated({ dividend: 10, divisor: 4 })).toBe(2.5)
      expect(yield* unsafeDivideValidated({ dividend: 10, divisor: 5 })).toBe(2)
      closeTo(yield* logValidated({ value: 2.718281828459045 }), 1, 5e-16)
      expect(yield* sumValidated({ values: Array.make(1, 2, 3) })).toBe(6)
      expect(yield* yield* argmaxValidated({ values: Array.make(1, 5, 3) })).toBe(1)
    }))

  it.effect("preserves typed decode failures for malformed and excess input", () =>
    Effect.gen(function*() {
      const excess = yield* Effect.flip(safeDivideValidated({ dividend: 10, divisor: 4, extra: true }))
      const empty = yield* Effect.flip(sumValidated({ values: Array.empty<number>() }))
      const invalidLog = yield* Effect.flip(logValidated({ value: -1 }))
      expect(Schema.is(NumericDecodeError)(excess)).toBe(true)
      expect(Schema.is(NumericDecodeError)(empty)).toBe(true)
      expect(Schema.is(NumericDecodeError)(invalidLog)).toBe(true)
    }))

  it.effect("distinguishes a decoded zero divisor from malformed input", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(unsafeDivideValidated({ dividend: 10, divisor: 0 }))
      expect(Schema.is(NumericDomainViolationError)(error)).toBe(true)
      expect(error.operation).toBe("unsafeDivide")
    }))
})

describe("Numeric runtime policies", () => {
  it.effect("preserves small terms with compensated accumulation that scalar accumulation loses", () =>
    Effect.gen(function*() {
      const values = Chunk.make(1e16, 1, 1, -1e16)
      const compensated = yield* sumWithPolicies(values)
      const scalar = yield* sumWithPolicies(values).pipe(
        Effect.provideService(BackendPolicyService, { policy: "scalar" })
      )

      expect(compensated).toBe(2)
      expect(scalar).toBe(0)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("strict precision rejects non-finite results while relaxed precision returns them", () =>
    Effect.gen(function*() {
      const infinity = Number.unsafeDivide(1, 0)
      const error = yield* Effect.flip(sumWithPolicies(Chunk.make(infinity, 1)).pipe(Effect.provide(strictLayer)))
      const result = yield* sumWithPolicies(Chunk.make(infinity, 1)).pipe(Effect.provide(relaxedLayer))
      expect(Schema.is(NumericDomainViolationError)(error)).toBe(true)
      expect(result).toBe(infinity)
    }))

  it.effect("runs cancellation-aware transforms under both precision policies", () =>
    Effect.gen(function*() {
      const strictLog = yield* log1pWithPolicies(1e-15).pipe(Effect.provide(strictLayer))
      const relaxedLog = yield* log1pWithPolicies(1e-15).pipe(Effect.provide(relaxedLayer))
      const strictExp = yield* expm1WithPolicies(1e-15).pipe(Effect.provide(strictLayer))
      const relaxedExp = yield* expm1WithPolicies(1e-15).pipe(Effect.provide(relaxedLayer))
      expect(strictLog).toBe(9.999999999999995e-16)
      expect(relaxedLog).toBe(strictLog)
      expect(strictExp).toBe(1.0000000000000007e-15)
      expect(relaxedExp).toBe(strictExp)
    }))
})
