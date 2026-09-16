import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Number, Schema } from "effect"

import {
  abs,
  DecodeError,
  DomainViolationError,
  isFinite,
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
} from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"

const strictLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const tolerance = 1e-12
const closeTo = (actual: number, expected: number) =>
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Numeric log-space kernels", () => {
  it.effect("adds finite log-weights without materializing their exponentials", () =>
    Effect.gen(function*() {
      closeTo(logaddexp(1, 1), 1.6931471805599454)
      closeTo(logaddexp(1_000, 999), 1000.3132616875182)
      expect(logaddexp(5, Number.unsafeDivide(-1, 0))).toBe(5)
      expect(logaddexp(Number.unsafeDivide(1, 0), Number.unsafeDivide(1, 0))).toBe(Number.unsafeDivide(1, 0))
      expect(logaddexp(Number.unsafeDivide(1, 0), Number.unsafeDivide(0, 0))).toBeNaN()
    }))

  it.effect("subtracts only inside the strict positive-difference domain", () =>
    Effect.gen(function*() {
      closeTo(logsubexp(5, 3), 4.854586542131141)
      expect(logsubexp(3, 3)).toBeNaN()
      expect(logsubexp(2, 3)).toBeNaN()
    }))

  it.effect("uses cancellation-safe branches around zero and negative ln(2)", () =>
    Effect.gen(function*() {
      closeTo(log1mexp(-1), -0.45867514538708193)
      closeTo(log1mexp(-1e-15), -34.538776394910684)
      expect(log1mexp(Number.unsafeDivide(-1, 0))).toBe(-0)
      expect(log1mexp(0)).toBeNaN()
      closeTo(log1pexp(0), 0.6931471805599453)
      expect(log1pexp(40)).toBe(40)
      closeTo(log1pexp(-40), 4.248354255291589e-18)
    }))

  it.effect("honors zero-multiplier conventions without masking nonzero domain errors", () =>
    Effect.gen(function*() {
      expect(xlogy(0, 0)).toBe(0)
      closeTo(xlogy(2, 10), 4.605170185988092)
      expect(xlogy(1, -1)).toBeNaN()
      expect(xlog1py(0, -1)).toBe(0)
      closeTo(xlog1py(1, 1), 0.6931471805599453)
    }))

  it.effect("handles empty, singleton, shifted, and infinite log-sum-exp inputs", () =>
    Effect.gen(function*() {
      expect(logSumExp(Chunk.empty())).toBe(Number.unsafeDivide(-1, 0))
      expect(logSumExp(Chunk.of(42))).toBe(42)
      closeTo(logSumExp(Chunk.make(1, 2, 3)), 3.40760596444438)
      closeTo(logSumExp(Chunk.make(1_000, 999, 998)), 1000.4076059644444)
      expect(logSumExp(Chunk.make(Number.unsafeDivide(1, 0), 2))).toBe(Number.unsafeDivide(1, 0))
      expect(logSumExp(Chunk.make(Number.unsafeDivide(1, 0), Number.unsafeDivide(0, 0)))).toBeNaN()
    }))
})

describe("Numeric log-space boundaries", () => {
  it.effect("decodes finite operands and vectors", () =>
    Effect.gen(function*() {
      const pair = yield* logaddexpValidated({ a: 1, b: 2 })
      const vector = yield* logSumExpValidated({ values: Array.make(1, 2, 3) })
      expect(isFinite(pair)).toBe(true)
      closeTo(vector, 3.40760596444438)
    }))

  it.effect("returns typed decode failures for excess, empty, and non-numeric vectors", () =>
    Effect.gen(function*() {
      const excess = yield* Effect.flip(logaddexpValidated({ a: 1, b: 2, extra: true }))
      const empty = yield* Effect.flip(logSumExpValidated({ values: Array.empty<number>() }))
      const invalid = yield* Effect.flip(logSumExpValidated({ values: Array.make("a", "b") }))
      expect(Schema.is(DecodeError)(excess)).toBe(true)
      expect(Schema.is(DecodeError)(empty)).toBe(true)
      expect(Schema.is(DecodeError)(invalid)).toBe(true)
    }))
})

describe("Numeric log-space policy operations", () => {
  it.effect("computes finite results under strict and relaxed policies", () =>
    Effect.gen(function*() {
      const strictPair = yield* logaddexpWithPolicies(1, 1).pipe(Effect.provide(strictLayer))
      const relaxedPair = yield* logaddexpWithPolicies(1, 1).pipe(Effect.provide(relaxedLayer))
      const strictVector = yield* logSumExpWithPolicies(Chunk.make(1, 2, 3)).pipe(Effect.provide(strictLayer))
      const relaxedVector = yield* logSumExpWithPolicies(Chunk.make(1, 2, 3)).pipe(Effect.provide(relaxedLayer))
      closeTo(strictPair, 1.6931471805599454)
      closeTo(relaxedPair, 1.6931471805599454)
      closeTo(strictVector, 3.40760596444438)
      closeTo(relaxedVector, 3.40760596444438)
    }))

  it.effect("rejects an infinite result only under strict precision", () =>
    Effect.gen(function*() {
      const infinity = Number.unsafeDivide(1, 0)
      const error = yield* Effect.flip(logaddexpWithPolicies(infinity, 1).pipe(Effect.provide(strictLayer)))
      const result = yield* logaddexpWithPolicies(infinity, 1).pipe(Effect.provide(relaxedLayer))
      expect(Schema.is(DomainViolationError)(error)).toBe(true)
      expect(result).toBe(infinity)
    }))
})
