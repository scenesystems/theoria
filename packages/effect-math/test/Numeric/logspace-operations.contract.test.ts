import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Exit, Number as N, Schema } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "../../src/contracts/index.js"
import {
  abs,
  log1mexp,
  log1pexp,
  logaddexp,
  logaddexpValidated,
  logaddexpWithPolicies,
  logsubexp,
  logSumExp,
  logSumExpValidated,
  logSumExpWithPolicies,
  xlog1py,
  xlogy
} from "../../src/Numeric/index.js"

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

const KERNEL_TOLERANCE = 1e-12
const LN2 = 0.6931471805599453
const isFiniteNumber = Schema.is(Schema.Finite)

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — logaddexp
// ---------------------------------------------------------------------------

describe("Numeric / logaddexp", () => {
  it.effect("logaddexp(1, 1) ≈ 1 + ln(2)", () =>
    Effect.gen(function*() {
      expectClose(logaddexp(1, 1), N.sum(1, LN2), KERNEL_TOLERANCE)
    }))

  it.effect("logaddexp(a, -Infinity) ≈ a", () =>
    Effect.gen(function*() {
      expectClose(logaddexp(5, N.negate(Infinity)), 5, KERNEL_TOLERANCE)
    }))

  it.effect("logaddexp(0, 0) ≈ ln(2)", () =>
    Effect.gen(function*() {
      expectClose(logaddexp(0, 0), LN2, KERNEL_TOLERANCE)
    }))

  it.effect("preserves negative finite inputs", () =>
    Effect.gen(function*() {
      expectClose(logaddexp(N.negate(2), N.negate(2)), N.subtract(LN2, 2), KERNEL_TOLERANCE)
    }))

  it.effect("preserves infinity and NaN edge behavior", () =>
    Effect.gen(function*() {
      const negativeInfinity = N.negate(Infinity)
      expect(logaddexp(negativeInfinity, negativeInfinity)).toBe(negativeInfinity)
      expect(logaddexp(Infinity, negativeInfinity)).toBe(Infinity)
      expect(logaddexp(negativeInfinity, Infinity)).toBe(Infinity)
      expect(logaddexp(Infinity, Infinity)).toBe(Infinity)
      expect(logaddexp(Infinity, 1)).toBe(Infinity)
      expect(logaddexp(1, Infinity)).toBe(Infinity)
      expect(logaddexp(NaN, 1)).toBeNaN()
      expect(logaddexp(1, NaN)).toBeNaN()
      expect(logaddexp(NaN, Infinity)).toBeNaN()
      expect(logaddexp(Infinity, NaN)).toBeNaN()
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — logsubexp
// ---------------------------------------------------------------------------

describe("Numeric / logsubexp", () => {
  it.effect("logsubexp(5, 3) ≈ 4.8546", () =>
    Effect.gen(function*() {
      expectClose(logsubexp(5, 3), 4.854586542131141, KERNEL_TOLERANCE)
    }))

  it.effect("logsubexp(b >= a) returns NaN", () =>
    Effect.gen(function*() {
      expect(logsubexp(3, 3)).toBeNaN()
    }))

  it.effect("preserves negative, zero, infinity, and NaN edge behavior", () =>
    Effect.gen(function*() {
      const negativeInfinity = N.negate(Infinity)
      expectClose(logsubexp(N.negate(1), N.negate(2)), N.negate(1.4586751453870819), KERNEL_TOLERANCE)
      expect(logsubexp(0, negativeInfinity)).toBe(0)
      expect(logsubexp(Infinity, 0)).toBe(Infinity)
      expect(logsubexp(Infinity, Infinity)).toBeNaN()
      expect(logsubexp(negativeInfinity, negativeInfinity)).toBeNaN()
      expect(logsubexp(NaN, 0)).toBeNaN()
      expect(logsubexp(0, NaN)).toBeNaN()
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — log1mexp
// ---------------------------------------------------------------------------

describe("Numeric / log1mexp", () => {
  it.effect("log1mexp(-1) ≈ -0.4587", () =>
    Effect.gen(function*() {
      expectClose(log1mexp(N.negate(1)), N.negate(0.45867514538708193), KERNEL_TOLERANCE)
    }))

  it.effect("log1mexp(0) returns NaN", () =>
    Effect.gen(function*() {
      expect(log1mexp(0)).toBeNaN()
    }))

  it.effect("uses both stable branches at the negative-ln(2) threshold", () =>
    Effect.gen(function*() {
      expectClose(log1mexp(N.negate(0.1)), N.negate(2.3521684610440907), KERNEL_TOLERANCE)
      expectClose(log1mexp(N.negate(LN2)), N.negate(LN2), KERNEL_TOLERANCE)
    }))

  it.effect("preserves domain and non-finite edge behavior", () =>
    Effect.gen(function*() {
      expect(log1mexp(N.negate(Infinity))).toBe(N.negate(0))
      expect(log1mexp(1)).toBeNaN()
      expect(log1mexp(NaN)).toBeNaN()
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — log1pexp
// ---------------------------------------------------------------------------

describe("Numeric / log1pexp", () => {
  it.effect("log1pexp(0) ≈ ln(2)", () =>
    Effect.gen(function*() {
      expectClose(log1pexp(0), LN2, KERNEL_TOLERANCE)
    }))

  it.effect("log1pexp(40) ≈ 40", () =>
    Effect.gen(function*() {
      expectClose(log1pexp(40), 40, KERNEL_TOLERANCE)
    }))

  it.effect("preserves both stability thresholds", () =>
    Effect.gen(function*() {
      expect(log1pexp(33.3)).toBe(33.3)
      expect(log1pexp(33.3000000001)).toBe(33.3000000001)
      expect(log1pexp(N.negate(37))).toBe(8.533047625744066e-17)
      expect(log1pexp(N.negate(36.9999999999))).toBe(8.533047626597385e-17)
    }))

  it.effect("preserves infinity and NaN edge behavior", () =>
    Effect.gen(function*() {
      expect(log1pexp(Infinity)).toBe(Infinity)
      expect(log1pexp(N.negate(Infinity))).toBe(0)
      expect(log1pexp(NaN)).toBeNaN()
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — xlogy / xlog1py
// ---------------------------------------------------------------------------

describe("Numeric / xlogy", () => {
  it.effect("xlogy(0, 5) === 0", () =>
    Effect.gen(function*() {
      expect(xlogy(0, 5)).toStrictEqual(0)
    }))

  it.effect("xlogy(2, 10) ≈ 4.6052", () =>
    Effect.gen(function*() {
      expectClose(xlogy(2, 10), 4.605170185988092, KERNEL_TOLERANCE)
    }))

  it.effect("preserves zero convention, negative products, and NaN", () =>
    Effect.gen(function*() {
      expect(xlogy(N.negate(0), NaN)).toBe(0)
      expectClose(xlogy(N.negate(2), 2), N.negate(1.3862943611198906), KERNEL_TOLERANCE)
      expect(xlogy(NaN, 2)).toBeNaN()
    }))
})

describe("Numeric / xlog1py", () => {
  it.effect("xlog1py(0, 100) === 0", () =>
    Effect.gen(function*() {
      expect(xlog1py(0, 100)).toStrictEqual(0)
    }))

  it.effect("xlog1py(1, 1) ≈ ln(2)", () =>
    Effect.gen(function*() {
      expectClose(xlog1py(1, 1), LN2, KERNEL_TOLERANCE)
    }))

  it.effect("preserves zero convention, negative products, and NaN", () =>
    Effect.gen(function*() {
      expect(xlog1py(N.negate(0), NaN)).toBe(0)
      expectClose(xlog1py(N.negate(2), 1), N.negate(1.3862943611198906), KERNEL_TOLERANCE)
      expect(xlog1py(NaN, 1)).toBeNaN()
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — logSumExp
// ---------------------------------------------------------------------------

describe("Numeric / logSumExp", () => {
  it.effect("logSumExp([1, 2, 3]) ≈ 3.4076", () =>
    Effect.gen(function*() {
      expectClose(logSumExp(Chunk.make(1, 2, 3)), 3.40760596444438, KERNEL_TOLERANCE)
    }))

  it.effect("logSumExp empty chunk → -Infinity", () =>
    Effect.gen(function*() {
      expect(logSumExp(Chunk.empty())).toStrictEqual(-Infinity)
    }))

  it.effect("preserves singleton finite and non-finite values", () =>
    Effect.gen(function*() {
      expect(logSumExp(Chunk.make(N.negate(2)))).toBe(N.negate(2))
      expect(logSumExp(Chunk.make(Infinity))).toBe(Infinity)
      expect(logSumExp(Chunk.make(N.negate(Infinity)))).toBe(N.negate(Infinity))
      expect(logSumExp(Chunk.make(NaN))).toBeNaN()
    }))

  it.effect("propagates NaN and otherwise lets positive infinity dominate", () =>
    Effect.gen(function*() {
      const negativeInfinity = N.negate(Infinity)
      expect(logSumExp(Chunk.make(negativeInfinity, negativeInfinity))).toBe(negativeInfinity)
      expect(logSumExp(Chunk.make(Infinity, 0))).toBe(Infinity)
      expect(logSumExp(Chunk.make(0, Infinity, negativeInfinity))).toBe(Infinity)
      expect(logSumExp(Chunk.make(Infinity, Infinity))).toBe(Infinity)
      expect(logSumExp(Chunk.make(NaN, 0))).toBeNaN()
      expect(logSumExp(Chunk.make(NaN, negativeInfinity))).toBeNaN()
      expect(logSumExp(Chunk.make(negativeInfinity, NaN))).toBeNaN()
      expect(logSumExp(Chunk.make(Infinity, NaN))).toBeNaN()
      expect(logSumExp(Chunk.make(NaN, Infinity))).toBeNaN()
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Numeric / logaddexpValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* logaddexpValidated({ a: 1, b: 2 })
      expect(isFiniteNumber(result)).toBe(true)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(logaddexpValidated({ a: 1, b: 2, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Numeric / logSumExpValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* logSumExpValidated({ values: Arr.make(1, 2, 3) })
      expectClose(result, 3.40760596444438, KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(logSumExpValidated({ values: Arr.make(1, 2), extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))

  it.effect("rejects non-numeric values", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(logSumExpValidated({ values: Arr.make("a", "b") }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Numeric / logaddexpWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const result = yield* logaddexpWithPolicies(1, 1)
      expectClose(result, N.sum(1, LN2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* logaddexpWithPolicies(1, 1)
      expectClose(result, N.sum(1, LN2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Numeric / logSumExpWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const result = yield* logSumExpWithPolicies(Chunk.make(1, 2, 3))
      expectClose(result, 3.40760596444438, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* logSumExpWithPolicies(Chunk.make(1, 2, 3))
      expectClose(result, 3.40760596444438, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("rejects a non-finite result under strict precision", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(logSumExpWithPolicies(Chunk.make(Infinity)))
      expect(error._tag).toStrictEqual("NumericDomainViolationError")
      expect(error.operation).toStrictEqual("logSumExpWithPolicies")
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("allows a non-finite result under relaxed precision", () =>
    Effect.gen(function*() {
      expect(yield* logSumExpWithPolicies(Chunk.make(Infinity))).toBe(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
