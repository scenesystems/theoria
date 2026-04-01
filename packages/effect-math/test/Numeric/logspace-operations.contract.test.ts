import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Exit, Number as N, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
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
} from "../../src/Numeric/operations.js"

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

const KERNEL_TOLERANCE = 1e-12

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — logaddexp
// ---------------------------------------------------------------------------

describe("Numeric / logaddexp", () => {
  it.effect("logaddexp(1, 1) ≈ 1 + ln(2)", () =>
    Effect.gen(function*() {
      expectClose(logaddexp(1, 1), N.sum(1, Math.LN2), KERNEL_TOLERANCE)
    }))

  it.effect("logaddexp(a, -Infinity) ≈ a", () =>
    Effect.gen(function*() {
      expectClose(logaddexp(5, -Infinity), 5, KERNEL_TOLERANCE)
    }))

  it.effect("logaddexp(0, 0) ≈ ln(2)", () =>
    Effect.gen(function*() {
      expectClose(logaddexp(0, 0), Math.LN2, KERNEL_TOLERANCE)
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
      expect(Number.isNaN(logsubexp(3, 3))).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — log1mexp
// ---------------------------------------------------------------------------

describe("Numeric / log1mexp", () => {
  it.effect("log1mexp(-1) ≈ -0.4587", () =>
    Effect.gen(function*() {
      expectClose(log1mexp(-1), -0.45867514538708193, KERNEL_TOLERANCE)
    }))

  it.effect("log1mexp(0) returns NaN", () =>
    Effect.gen(function*() {
      expect(Number.isNaN(log1mexp(0))).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — log1pexp
// ---------------------------------------------------------------------------

describe("Numeric / log1pexp", () => {
  it.effect("log1pexp(0) ≈ ln(2)", () =>
    Effect.gen(function*() {
      expectClose(log1pexp(0), Math.LN2, KERNEL_TOLERANCE)
    }))

  it.effect("log1pexp(40) ≈ 40", () =>
    Effect.gen(function*() {
      expectClose(log1pexp(40), 40, KERNEL_TOLERANCE)
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
})

describe("Numeric / xlog1py", () => {
  it.effect("xlog1py(0, 100) === 0", () =>
    Effect.gen(function*() {
      expect(xlog1py(0, 100)).toStrictEqual(0)
    }))

  it.effect("xlog1py(1, 1) ≈ ln(2)", () =>
    Effect.gen(function*() {
      expectClose(xlog1py(1, 1), Math.LN2, KERNEL_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — logSumExp
// ---------------------------------------------------------------------------

describe("Numeric / logSumExp", () => {
  it.effect("logSumExp([1, 2, 3]) ≈ 3.4076", () =>
    Effect.gen(function*() {
      expectClose(logSumExp(Chunk.fromIterable([1, 2, 3])), 3.40760596444438, KERNEL_TOLERANCE)
    }))

  it.effect("logSumExp empty chunk → -Infinity", () =>
    Effect.gen(function*() {
      expect(logSumExp(Chunk.empty())).toStrictEqual(-Infinity)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Numeric / logaddexpValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* logaddexpValidated({ a: 1, b: 2 })
      expect(Number.isFinite(result)).toBe(true)
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
      const result = yield* logSumExpValidated({ values: [1, 2, 3] })
      expectClose(result, 3.40760596444438, KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(logSumExpValidated({ values: [1, 2], extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))

  it.effect("rejects non-numeric values", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(logSumExpValidated({ values: ["a", "b"] }))
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
      expectClose(result, N.sum(1, Math.LN2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* logaddexpWithPolicies(1, 1)
      expectClose(result, N.sum(1, Math.LN2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Numeric / logSumExpWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const result = yield* logSumExpWithPolicies([1, 2, 3])
      expectClose(result, 3.40760596444438, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* logSumExpWithPolicies([1, 2, 3])
      expectClose(result, 3.40760596444438, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
