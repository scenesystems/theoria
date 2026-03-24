import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Number as EffectNumber, Schema } from "effect"

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

const seed = Schema.decodeUnknownSync(Seed)(42)

// ── Full backend × precision layers (Numeric, LinearAlgebra) ──

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "strict",
  backend: "typed-array",
  diagnostics: "disabled"
})

const strictScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const relaxedTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "relaxed",
  backend: "typed-array",
  diagnostics: "disabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

// ── Precision-only layers (all other domains) ──

const strictPolicy: { readonly policy: "strict" } = { policy: "strict" }
const relaxedPolicy: { readonly policy: "relaxed" } = { policy: "relaxed" }
const disabledDiag: { readonly policy: "disabled" } = { policy: "disabled" }

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
      const values = [0.1, 0.2, 0.3, 0.4, 0.5]

      const strictTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(strictTypedArrayLayer))
      const strictScalar = yield* sumWithPolicies(values).pipe(Effect.provide(strictScalarLayer))
      const relaxedTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedTypedArrayLayer))
      const relaxedScalar = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedScalarLayer))

      expect(EffectNumber.Equivalence(strictTypedArray, strictScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedTypedArray)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictScalar, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("all 4 cells produce equivalent results for finite inputs (larger array)", () =>
    Effect.gen(function*() {
      const values = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 10.0]

      const strictTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(strictTypedArrayLayer))
      const strictScalar = yield* sumWithPolicies(values).pipe(Effect.provide(strictScalarLayer))
      const relaxedTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedTypedArrayLayer))
      const relaxedScalar = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedScalarLayer))

      expect(EffectNumber.Equivalence(strictTypedArray, strictScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedTypedArray)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictScalar, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("strict + typed-array rejects NaN while relaxed does not", () =>
    Effect.gen(function*() {
      const valuesWithNaN = [1.0, NaN, 3.0]

      const strictError = yield* Effect.flip(
        sumWithPolicies(valuesWithNaN).pipe(Effect.provide(strictTypedArrayLayer))
      )
      expect(strictError._tag).toStrictEqual("NumericDomainViolationError")
      expect(strictError.operation).toStrictEqual("sumWithPolicies")

      const relaxedResult = yield* sumWithPolicies(valuesWithNaN).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(Number.isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// LinearAlgebra — backend × precision (2×2, uses BackendPolicyService)
// ══════════════════════════════════════════════════════════════

describe("LinearAlgebra precision × backend matrix", () => {
  it.effect("all 4 cells produce equivalent dot product for finite inputs", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, 2, 3])
      const b = Chunk.fromIterable([4, 5, 6])

      const strictTypedArray = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictTypedArrayLayer))
      const strictScalar = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictScalarLayer))
      const relaxedTypedArray = yield* dotWithPolicies(a, b).pipe(Effect.provide(relaxedTypedArrayLayer))
      const relaxedScalar = yield* dotWithPolicies(a, b).pipe(Effect.provide(relaxedScalarLayer))

      expect(strictTypedArray).toStrictEqual(32)
      expect(EffectNumber.Equivalence(strictTypedArray, strictScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedTypedArray)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN while relaxed passes through", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, NaN, 3])
      const b = Chunk.fromIterable([4, 5, 6])

      const strictError = yield* Effect.flip(
        dotWithPolicies(a, b).pipe(Effect.provide(strictTypedArrayLayer))
      )
      expect(strictError._tag).toStrictEqual("LinearAlgebraDomainViolationError")
      expect(strictError.operation).toStrictEqual("dotWithPolicies")

      const relaxedResult = yield* dotWithPolicies(a, b).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(Number.isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Geometry — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Geometry precision policy matrix", () => {
  it.effect("both precision policies produce equivalent distance for finite inputs", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0, 0])
      const b = Chunk.fromIterable([3, 4])

      const strictResult = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toStrictEqual(5)
      expect(EffectNumber.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN while relaxed passes through", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, NaN])
      const b = Chunk.fromIterable([3, 4])

      const strictError = yield* Effect.flip(
        distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("GeometryDomainViolationError")
      expect(strictError.operation).toStrictEqual("distanceWithPolicies")

      const relaxedResult = yield* distanceWithPolicies(a, b, "euclidean").pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(Number.isNaN(relaxedResult)).toStrictEqual(true)
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
      expect(EffectNumber.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
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
      expect(Number.isFinite(relaxedResult)).toStrictEqual(false)
    }))
})

// ══════════════════════════════════════════════════════════════
// Statistics — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Statistics precision policy matrix", () => {
  it.effect("both precision policies produce equivalent summaryStatistics for finite inputs", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([2, 4, 6, 8])

      const strictResult = yield* summaryStatisticsWithPolicies(values).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* summaryStatisticsWithPolicies(values).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult.mean).toStrictEqual(5)
      expect(EffectNumber.Equivalence(strictResult.mean, relaxedResult.mean)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictResult.variance, relaxedResult.variance)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictResult.standardDeviation, relaxedResult.standardDeviation))
        .toStrictEqual(true)
    }))

  it.effect("strict rejects NaN with domain violation error", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([1, NaN, 3, 4])

      const strictError = yield* Effect.flip(
        summaryStatisticsWithPolicies(values).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(strictError.operation).toStrictEqual("summaryStatisticsWithPolicies")
    }))

  it.effect("relaxed allows NaN past precision check but constructor rejects non-finite", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([1, NaN, 3, 4])

      // Relaxed precision passes the NaN through the policy gate, but the
      // SummaryStatistics Schema.TaggedClass constructor requires FiniteNumber
      // fields, so a ParseError is raised instead.
      const exit = yield* Effect.exit(
        summaryStatisticsWithPolicies(values).pipe(Effect.provide(relaxedDisabledLayer))
      )
      expect(exit._tag).toStrictEqual("Failure")
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
      expect(EffectNumber.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
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
      expect(Number.isFinite(relaxedResult)).toStrictEqual(false)
    }))
})

// ══════════════════════════════════════════════════════════════
// Algebra — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Algebra precision policy matrix", () => {
  it.effect("both precision policies produce equivalent polyEval for finite inputs", () =>
    Effect.gen(function*() {
      // P(x) = 1 - 2x + x² → P(3) = 1 - 6 + 9 = 4
      const coefficients = Chunk.fromIterable([1, -2, 1])

      const strictResult = yield* polyEvalWithPolicies(coefficients, 3).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* polyEvalWithPolicies(coefficients, 3).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toStrictEqual(4)
      expect(EffectNumber.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN coefficients while relaxed passes through", () =>
    Effect.gen(function*() {
      const coefficients = Chunk.fromIterable([1, NaN, 1])

      const strictError = yield* Effect.flip(
        polyEvalWithPolicies(coefficients, 3).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("AlgebraDomainViolationError")
      expect(strictError.operation).toStrictEqual("polyEvalWithPolicies")

      const relaxedResult = yield* polyEvalWithPolicies(coefficients, 3).pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(Number.isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Calculus — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Calculus precision policy matrix", () => {
  it.effect("both precision policies produce equivalent trapezoid for finite inputs", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])

      const strictResult = yield* trapezoidWithPolicies(values, 1).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* trapezoidWithPolicies(values, 1).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toStrictEqual(22)
      expect(EffectNumber.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))

  it.effect("strict rejects NaN while relaxed passes through", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, NaN, 4, 9, 16])

      const strictError = yield* Effect.flip(
        trapezoidWithPolicies(values, 1).pipe(Effect.provide(strictDisabledLayer))
      )
      expect(strictError._tag).toStrictEqual("CalculusDomainViolationError")
      expect(strictError.operation).toStrictEqual("trapezoidWithPolicies")

      const relaxedResult = yield* trapezoidWithPolicies(values, 1).pipe(
        Effect.provide(relaxedDisabledLayer)
      )
      expect(Number.isNaN(relaxedResult)).toStrictEqual(true)
    }))
})

// ══════════════════════════════════════════════════════════════
// Optimization — precision × diagnostics
// ══════════════════════════════════════════════════════════════

describe("Optimization precision policy matrix", () => {
  it.effect("both precision policies produce equivalent bisect for finite inputs", () =>
    Effect.gen(function*() {
      const f = (x: number) => x * x - 2

      const strictResult = yield* bisectWithPolicies(f, 0, 2).pipe(Effect.provide(strictDisabledLayer))
      const relaxedResult = yield* bisectWithPolicies(f, 0, 2).pipe(Effect.provide(relaxedDisabledLayer))

      expect(strictResult).toBeCloseTo(Math.SQRT2, 5)
      expect(EffectNumber.Equivalence(strictResult, relaxedResult)).toStrictEqual(true)
    }))
})
