import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Exit, Number as N, Schema } from "effect"

import {
  derivative,
  simpson,
  simpsonValidated,
  simpsonWithPolicies,
  trapezoid,
  trapezoidValidated,
  trapezoidWithPolicies
} from "../../src/Calculus/operations.js"
import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"

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

const KERNEL_TOLERANCE = 1e-6

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — derivative
// ---------------------------------------------------------------------------

describe("Calculus / derivative", () => {
  it.effect("d/dx(x²)|₁ ≈ 2", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(x, x)
      expectClose(derivative(f, 1), 2, KERNEL_TOLERANCE)
    }))

  it.effect("d/dx(sin)|₀ ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(derivative(Math.sin, 0), 1, KERNEL_TOLERANCE)
    }))

  it.effect("d/dx(exp)|₀ ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(derivative(Math.exp, 0), 1, KERNEL_TOLERANCE)
    }))

  it.effect("custom h overrides default", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(x, x)
      expectClose(derivative(f, 1, 1e-5), 2, 1e-4)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — trapezoid
// ---------------------------------------------------------------------------

describe("Calculus / trapezoid", () => {
  it.effect("constant function: ∫1 dx from 0 to 1 = 1", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([1, 1, 1, 1, 1])
      expectClose(trapezoid(values, 0.25), 1, 1e-15)
    }))

  it.effect("linear function: ∫x dx from 0 to 4 = 8", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 2, 3, 4])
      expectClose(trapezoid(values, 1), 8, 1e-15)
    }))

  it.effect("quadratic: ∫x² dx from 0 to 4 ≈ 22 (trapezoidal)", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      expectClose(trapezoid(values, 1), 22, 1e-15)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — simpson
// ---------------------------------------------------------------------------

describe("Calculus / simpson", () => {
  it.effect("constant function: ∫2 dx from 0 to 4 = 8", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([2, 2, 2, 2, 2])
      expectClose(simpson(values, 1), 8, 1e-15)
    }))

  it.effect("linear function: exact for Simpson's", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 2, 3, 4])
      expectClose(simpson(values, 1), 8, 1e-15)
    }))

  it.effect("quadratic: Simpson's exact for polynomials ≤ degree 3", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      expectClose(simpson(values, 1), 21.333333333333332, 1e-12)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Calculus / trapezoidValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* trapezoidValidated({ values: [1, 1, 1, 1, 1], dx: 0.25 })
      expectClose(result, 1, 1e-15)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(trapezoidValidated({ values: [1, 1, 1], dx: 0.5, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Calculus / simpsonValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* simpsonValidated({ values: [0, 1, 4, 9, 16], dx: 1 })
      expectClose(result, 21.333333333333332, 1e-12)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(simpsonValidated({ values: [0, 1, 4], dx: 1, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Calculus / trapezoidWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      const result = yield* trapezoidWithPolicies(values, 1)
      expectClose(result, 22, 1e-15)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      const result = yield* trapezoidWithPolicies(values, 1)
      expectClose(result, 22, 1e-15)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Calculus / simpsonWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      const result = yield* simpsonWithPolicies(values, 1)
      expectClose(result, 21.333333333333332, 1e-12)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      const result = yield* simpsonWithPolicies(values, 1)
      expectClose(result, 21.333333333333332, 1e-12)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
