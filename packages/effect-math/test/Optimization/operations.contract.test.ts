import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, MutableRef, Number, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import * as Numeric from "../../src/Numeric/index.js"
import {
  bisect,
  bisectValidated,
  bisectWithPolicies,
  goldenSection,
  goldenSectionValidated,
  goldenSectionWithPolicies
} from "../../src/Optimization/operations.js"

const strictCompensatedLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const KERNEL_TOLERANCE = 1e-10

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — bisect
// ---------------------------------------------------------------------------

describe("Optimization / bisect", () => {
  it.effect("root of x²−2 ≈ √2", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      expectClose(bisect(f, 0, 2), Numeric.sqrt(2), KERNEL_TOLERANCE)
    }))

  it.effect("root of cos in [0,2] ≈ π/2", () =>
    Effect.gen(function*() {
      expectClose(bisect(Numeric.cos, 0, 2), Number.multiply(Numeric.pi, 0.5), KERNEL_TOLERANCE)
    }))

  it.effect("returns endpoint roots without evaluating the opposite endpoint", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const root = bisect(
        (x) => {
          MutableRef.increment(evaluations)
          return x
        },
        0,
        2
      )
      expect(root).toStrictEqual(0)
      expect(MutableRef.get(evaluations)).toStrictEqual(1)
    }))

  it.effect("preserves reversed brackets and iteration-budget boundaries", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      expectClose(bisect(f, 2, 0), Numeric.sqrt(2), KERNEL_TOLERANCE)
      expect(bisect(f, 0, 2, 1e-30, 1)).toStrictEqual(1.5)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — goldenSection
// ---------------------------------------------------------------------------

describe("Optimization / goldenSection", () => {
  it.effect("minimum of x² is at 0", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      expectClose(goldenSection(f, -2, 2), 0, KERNEL_TOLERANCE)
    }))

  it.effect("minimum of (x−1)² is at 1", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(Number.subtract(x, 1), Number.subtract(x, 1))
      expectClose(goldenSection(f, -2, 4), 1, KERNEL_TOLERANCE)
    }))

  it.effect("preserves reversed intervals and the zero-iteration callback budget", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const objective = (x: number) => {
        MutableRef.increment(evaluations)
        return Number.multiply(x, x)
      }
      expectClose(goldenSection(objective, 2, -2), 0, KERNEL_TOLERANCE)
      MutableRef.set(evaluations, 0)
      expect(goldenSection(objective, -2, 2, 1e-30, 0)).toStrictEqual(0)
      expect(MutableRef.get(evaluations)).toStrictEqual(2)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Optimization / bisectValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* bisectValidated(f, { a: 0, b: 2 })
      expectClose(result, Numeric.sqrt(2), KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* Effect.exit(bisectValidated(f, { a: 0, b: 2, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))

  it.effect("maps failed callbacks to typed kernel failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(bisectValidated(
        () => Schema.decodeUnknownSync(Schema.Number)({ malformed: true }),
        { a: 0, b: 2 }
      ))
      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("bisect")
    }))
})

describe("Optimization / goldenSectionValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* goldenSectionValidated(f, { a: -2, b: 2 })
      expectClose(result, 0, KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* Effect.exit(goldenSectionValidated(f, { a: -2, b: 2, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Optimization / bisectWithPolicies", () => {
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* bisectWithPolicies(f, 0, 2)
      expectClose(result, Numeric.sqrt(2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* bisectWithPolicies(f, 0, 2)
      expectClose(result, Numeric.sqrt(2), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Optimization / goldenSectionWithPolicies", () => {
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* goldenSectionWithPolicies(f, -2, 2)
      expectClose(result, 0, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* goldenSectionWithPolicies(f, -2, 2)
      expectClose(result, 0, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("maps objective callback failures instead of producing defects", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(goldenSectionWithPolicies(
        () => Schema.decodeUnknownSync(Schema.Number)({ malformed: true }),
        -2,
        2
      ))
      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("goldenSectionWithPolicies")
    }).pipe(Effect.provide(strictCompensatedLayer)))
})
