import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Number as N, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  bisect,
  bisectValidated,
  bisectWithPolicies,
  goldenSection,
  goldenSectionValidated,
  goldenSectionWithPolicies
} from "../../src/Optimization/operations.js"

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

const KERNEL_TOLERANCE = 1e-10

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — bisect
// ---------------------------------------------------------------------------

describe("Optimization / bisect", () => {
  it.effect("root of x²−2 ≈ √2", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.subtract(N.multiply(x, x), 2)
      expectClose(bisect(f, 0, 2), Math.sqrt(2), KERNEL_TOLERANCE)
    }))

  it.effect("root of cos in [0,2] ≈ π/2", () =>
    Effect.gen(function*() {
      expectClose(bisect(Math.cos, 0, 2), N.multiply(Math.PI, 0.5), KERNEL_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — goldenSection
// ---------------------------------------------------------------------------

describe("Optimization / goldenSection", () => {
  it.effect("minimum of x² is at 0", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(x, x)
      expectClose(goldenSection(f, -2, 2), 0, KERNEL_TOLERANCE)
    }))

  it.effect("minimum of (x−1)² is at 1", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(N.subtract(x, 1), N.subtract(x, 1))
      expectClose(goldenSection(f, -2, 4), 1, KERNEL_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Optimization / bisectValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.subtract(N.multiply(x, x), 2)
      const result = yield* bisectValidated(f, { a: 0, b: 2 })
      expectClose(result, Math.sqrt(2), KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.subtract(N.multiply(x, x), 2)
      const result = yield* Effect.exit(bisectValidated(f, { a: 0, b: 2, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Optimization / goldenSectionValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(x, x)
      const result = yield* goldenSectionValidated(f, { a: -2, b: 2 })
      expectClose(result, 0, KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(x, x)
      const result = yield* Effect.exit(goldenSectionValidated(f, { a: -2, b: 2, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Optimization / bisectWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.subtract(N.multiply(x, x), 2)
      const result = yield* bisectWithPolicies(f, 0, 2)
      expectClose(result, Math.sqrt(2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.subtract(N.multiply(x, x), 2)
      const result = yield* bisectWithPolicies(f, 0, 2)
      expectClose(result, Math.sqrt(2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Optimization / goldenSectionWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(x, x)
      const result = yield* goldenSectionWithPolicies(f, -2, 2)
      expectClose(result, 0, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const f = (x: number) => N.multiply(x, x)
      const result = yield* goldenSectionWithPolicies(f, -2, 2)
      expectClose(result, 0, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
