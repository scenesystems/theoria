import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Chunk, Effect, Layer, Number, Schema } from "effect"

import { polyEvalWithPolicies } from "../../../src/Algebra/operations.js"
import { trapezoidWithPolicies } from "../../../src/Calculus/operations.js"
import { Seed } from "../../../src/contracts/shared/BrandedScalars.js"
import {
  DiagnosticsPolicyService,
  makeDeterministicRuntimePoliciesLayer,
  PrecisionPolicyService
} from "../../../src/contracts/shared/RuntimePolicies.js"
import { distanceWithPolicies } from "../../../src/Geometry/operations.js"
import { dotWithPolicies } from "../../../src/LinearAlgebra/operations.js"
import { sumWithPolicies } from "../../../src/Numeric/operations.js"
import { bisectWithPolicies } from "../../../src/Optimization/operations.js"
import { normalPdfWithPolicies } from "../../../src/Probability/operations.js"
import { gammaWithPolicies } from "../../../src/Special/operations.js"
import { summaryStatisticsWithPolicies } from "../../../src/Statistics/operations.js"

const seed = Seed.make(42)
const NOT_A_NUMBER = Schema.decodeUnknownSync(Schema.NumberFromString)("NaN")
const SQRT_TWO = 1.4142135623730951
const isNaN = (value: number) => Boolean.not(Schema.is(Schema.NonNaN)(value))
const isNonFinite = (value: number) => Boolean.not(Schema.is(Schema.Finite)(value))

// ── Full backend × precision layers (Numeric, LinearAlgebra) ──

const strictCompensatedLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "strict",
  backend: "compensated",
  diagnostics: "disabled"
})

const strictScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const relaxedCompensatedLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "relaxed",
  backend: "compensated",
  diagnostics: "disabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

// ── Precision-only layers (all other domains) ──

const strictPolicy = PrecisionPolicyService.of({ policy: "strict" })
const relaxedPolicy = PrecisionPolicyService.of({ policy: "relaxed" })
const disabledDiag = DiagnosticsPolicyService.of({ policy: "disabled" })

const strictDisabledLayer = Layer.mergeAll(
  Layer.succeed(PrecisionPolicyService, strictPolicy),
  Layer.succeed(DiagnosticsPolicyService, disabledDiag)
)

const relaxedDisabledLayer = Layer.mergeAll(
  Layer.succeed(PrecisionPolicyService, relaxedPolicy),
  Layer.succeed(DiagnosticsPolicyService, disabledDiag)
)

// ══════════════════════════════════════════════════════════════
// Numeric — backend × precision (2×2)
// ══════════════════════════════════════════════════════════════

describe("backend × precision policy matrix", () => {
  it.effect("all 4 cells produce equivalent results for finite inputs (small array)", () =>
    Effect.gen(function*() {
      const values = Array.make(0.1, 0.2, 0.3, 0.4, 0.5)

      const strictCompensated = yield* sumWithPolicies(values).pipe(Effect.provide(strictCompensatedLayer))
      const strictScalar = yield* sumWithPolicies(values).pipe(Effect.provide(strictScalarLayer))
      const relaxedCompensated = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedCompensatedLayer))
      const relaxedScalar = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedScalarLayer))

      expect(strictCompensated).toStrictEqual(1.5)
      expect(Number.Equivalence(strictCompensated, strictScalar)).toStrictEqual(true)
      expect(Number.Equivalence(strictCompensated, relaxedCompensated)).toStrictEqual(true)
      expect(Number.Equivalence(strictCompensated, relaxedScalar)).toStrictEqual(true)
      expect(Number.Equivalence(strictScalar, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("all 4 cells produce equivalent results for finite inputs (larger array)", () =>
    Effect.gen(function*() {
      const values = Array.make(1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 10.0)

      const strictCompensated = yield* sumWithPolicies(values).pipe(Effect.provide(strictCompensatedLayer))
      const strictScalar = yield* sumWithPolicies(values).pipe(Effect.provide(strictScalarLayer))
      const relaxedCompensated = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedCompensatedLayer))
      const relaxedScalar = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedScalarLayer))

      expect(strictCompensated).toStrictEqual(59.5)
      expect(Number.Equivalence(strictCompensated, strictScalar)).toStrictEqual(true)
      expect(Number.Equivalence(strictCompensated, relaxedCompensated)).toStrictEqual(true)
      expect(Number.Equivalence(strictCompensated, relaxedScalar)).toStrictEqual(true)
      expect(Number.Equivalence(strictScalar, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("strict + compensated rejects NaN while relaxed does not", () =>
    Effect.gen(function*() {
      const valuesWithNaN = Array.make(1.0, NOT_A_NUMBER, 3.0)

      const strictError = yield* Effect.flip(
        sumWithPolicies(valuesWithNaN).pipe(Effect.provide(strictCompensatedLayer))
      )
      expect(strictError._tag).toStrictEqual("NumericDomainViolationError")
      expect(strictError.operation).toStrictEqual("sumWithPolicies")

      const relaxedResult = yield* sumWithPolicies(valuesWithNaN).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// LinearAlgebra — backend-preference metadata × precision (2×2, uses BackendPolicyService)
// ══════════════════════════════════════════════════════════════

describe("LinearAlgebra precision × backend-preference metadata matrix", () => {
  it.effect("the documented dot result is equivalent across all 4 policy cells", () =>
    Effect.gen(function*() {
      const a = Chunk.make(1, 2, 3)
      const b = Chunk.make(4, 5, 6)

      const strictCompensated = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictCompensatedLayer))
      const strictScalar = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictScalarLayer))
      const relaxedCompensated = yield* dotWithPolicies(a, b).pipe(Effect.provide(relaxedCompensatedLayer))
      const relaxedScalar = yield* dotWithPolicies(a, b).pipe(Effect.provide(relaxedScalarLayer))

      expect(strictCompensated).toStrictEqual(32)
      expect(Number.Equivalence(strictCompensated, strictScalar)).toStrictEqual(true)
      expect(Number.Equivalence(strictCompensated, relaxedCompensated)).toStrictEqual(true)
      expect(Number.Equivalence(strictCompensated, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN while relaxed passes through", () =>
    Effect.gen(function*() {
      const a = Chunk.make(1, NOT_A_NUMBER, 3)
      const b = Chunk.make(4, 5, 6)

      const strictError = yield* Effect.flip(
        dotWithPolicies(a, b).pipe(Effect.provide(strictCompensatedLayer))
      )
      expect(strictError._tag).toStrictEqual("LinearAlgebraDomainViolationError")
      expect(strictError.operation).toStrictEqual("dotWithPolicies")

      const relaxedResult = yield* dotWithPolicies(a, b).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Geometry — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Geometry precision policy matrix", () => {
  it.effect("both precision policies produce equivalent distance for finite inputs", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0, 0)
      const b = Chunk.make(3, 4)

      const strictResult = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toStrictEqual(5)
      expect(Number.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN while relaxed passes through", () =>
    Effect.gen(function*() {
      const a = Chunk.make(1, NOT_A_NUMBER)
      const b = Chunk.make(3, 4)

      const strictError = yield* Effect.flip(
        distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("GeometryDomainViolationError")
      expect(strictError.operation).toStrictEqual("distanceWithPolicies")

      const relaxedResult = yield* distanceWithPolicies(a, b, "euclidean").pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Probability — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Probability precision policy matrix", () => {
  it.effect("both precision policies produce equivalent normalPdf for finite inputs", () =>
    Effect.gen(function*() {
      const strictResult = yield* normalPdfWithPolicies(0, 0, 1).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* normalPdfWithPolicies(0, 0, 1).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toBeCloseTo(0.3989, 3)
      expect(Number.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects non-finite normalPdf while relaxed passes through", () =>
    Effect.gen(function*() {
      // sigma=0 produces Infinity in the PDF computation
      const strictError = yield* Effect.flip(
        normalPdfWithPolicies(0, 0, 0).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("ProbabilityDomainViolationError")
      expect(strictError.operation).toStrictEqual("normalPdfWithPolicies")

      const relaxedResult = yield* normalPdfWithPolicies(0, 0, 0).pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(isNonFinite(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Statistics — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Statistics precision policy matrix", () => {
  it.effect("both precision policies produce equivalent summaryStatistics for finite inputs", () =>
    Effect.gen(function*() {
      const values = Chunk.make(2, 4, 6, 8)

      const strictResult = yield* summaryStatisticsWithPolicies(values).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* summaryStatisticsWithPolicies(values).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult.mean).toStrictEqual(5)
      expect(Number.Equivalence(strictResult.mean, relaxedResult.mean)).toStrictEqual(true)
      expect(Number.Equivalence(strictResult.variance, relaxedResult.variance)).toStrictEqual(true)
      expect(Number.Equivalence(strictResult.standardDeviation, relaxedResult.standardDeviation))
        .toStrictEqual(true)
    }))

  it.effect("strict rejects NaN with domain violation error", () =>
    Effect.gen(function*() {
      const values = Chunk.make(1, NOT_A_NUMBER, 3, 4)

      const strictError = yield* Effect.flip(
        summaryStatisticsWithPolicies(values).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(strictError.operation).toStrictEqual("summaryStatisticsWithPolicies")
    }))

  it.effect("relaxed reports non-finite result-schema violations as typed failures", () =>
    Effect.gen(function*() {
      const nonFiniteInputError = yield* Effect.flip(
        summaryStatisticsWithPolicies(Chunk.make(1, NOT_A_NUMBER, 3, 4)).pipe(
          Effect.provide(relaxedDisabledLayer)
        )
      )
      expect(nonFiniteInputError._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(nonFiniteInputError.operation).toStrictEqual("summaryStatisticsWithPolicies")

      const overflowingFiniteInputError = yield* Effect.flip(
        summaryStatisticsWithPolicies(Chunk.make(1e308, -1e308)).pipe(
          Effect.provide(relaxedDisabledLayer)
        )
      )
      expect(overflowingFiniteInputError._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(overflowingFiniteInputError.operation).toStrictEqual("summaryStatisticsWithPolicies")
    }))
})

// ══════════════════════════════════════════════════════════════
// Special — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Special precision policy matrix", () => {
  it.effect("both precision policies produce equivalent gamma for finite inputs", () =>
    Effect.gen(function*() {
      const strictResult = yield* gammaWithPolicies(5).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* gammaWithPolicies(5).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toBeCloseTo(24, 5)
      expect(Number.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects non-finite gamma while relaxed passes through", () =>
    Effect.gen(function*() {
      // Γ(0) is Infinity
      const strictError = yield* Effect.flip(
        gammaWithPolicies(0).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("SpecialDomainViolationError")
      expect(strictError.operation).toStrictEqual("gammaWithPolicies")

      const relaxedResult = yield* gammaWithPolicies(0).pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(isNonFinite(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Algebra — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Algebra precision policy matrix", () => {
  it.effect("both precision policies produce equivalent polyEval for finite inputs", () =>
    Effect.gen(function*() {
      // P(x) = 1 - 2x + x² → P(3) = 1 - 6 + 9 = 4
      const coefficients = Chunk.make(1, -2, 1)

      const strictResult = yield* polyEvalWithPolicies(coefficients, 3).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* polyEvalWithPolicies(coefficients, 3).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toStrictEqual(4)
      expect(Number.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN coefficients while relaxed passes through", () =>
    Effect.gen(function*() {
      const coefficients = Chunk.make(1, NOT_A_NUMBER, 1)

      const strictError = yield* Effect.flip(
        polyEvalWithPolicies(coefficients, 3).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("AlgebraDomainViolationError")
      expect(strictError.operation).toStrictEqual("polyEvalWithPolicies")

      const relaxedResult = yield* polyEvalWithPolicies(coefficients, 3).pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Calculus — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Calculus precision policy matrix", () => {
  it.effect("both precision policies produce equivalent trapezoid for finite inputs", () =>
    Effect.gen(function*() {
      const values = Chunk.make(0, 1, 4, 9, 16)

      const strictResult = yield* trapezoidWithPolicies(values, 1).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* trapezoidWithPolicies(values, 1).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toStrictEqual(22)
      expect(Number.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN while relaxed passes through", () =>
    Effect.gen(function*() {
      const values = Chunk.make(0, NOT_A_NUMBER, 4, 9, 16)

      const strictError = yield* Effect.flip(
        trapezoidWithPolicies(values, 1).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("CalculusDomainViolationError")
      expect(strictError.operation).toStrictEqual("trapezoidWithPolicies")

      const relaxedResult = yield* trapezoidWithPolicies(values, 1).pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Optimization — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Optimization precision policy matrix", () => {
  it.effect("both precision policies produce equivalent bisect for finite inputs", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)

      const strictResult = yield* bisectWithPolicies(f, 0, 2).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* bisectWithPolicies(f, 0, 2).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toBeCloseTo(SQRT_TWO, 5)
      expect(Number.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))
})
