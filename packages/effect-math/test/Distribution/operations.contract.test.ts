import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Number, Predicate, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  betaCdf,
  betaCdfValidated,
  betaCdfWithPolicies,
  betaPdf,
  categoricalPmf,
  categoricalPmfValidated,
  exponentialPdf,
  normalCdf,
  normalCdfValidated,
  normalCdfWithPolicies,
  normalEntropy,
  normalMean,
  normalPdf,
  normalPdfValidated,
  normalPdfWithPolicies,
  normalQuantile,
  normalQuantileValidated,
  normalVariance,
  uniformPdf,
  uniformPdfValidated
} from "../../src/Distribution/operations.js"
import { isFinite, pi, sqrt } from "../../src/Numeric/index.js"

const strictLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "enabled"
})

const relaxedLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const isNaN = Predicate.not(Schema.is(Schema.NonNaN))

// ---------------------------------------------------------------------------
// Pure kernel operations — Normal
// ---------------------------------------------------------------------------

describe("Distribution / normalPdf", () => {
  it.effect("peak value at x=mu", () =>
    Effect.gen(function*() {
      const expected = Number.unsafeDivide(1, sqrt(Number.multiply(2, pi)))
      expect(normalPdf(0, 0, 1)).toBeCloseTo(expected)
    }))

  it.effect("symmetric around mu", () =>
    Effect.gen(function*() {
      expect(normalPdf(1, 0, 1)).toBeCloseTo(normalPdf(-1, 0, 1))
    }))
})

describe("Distribution / normalCdf", () => {
  it.effect("CDF at mean equals 0.5", () =>
    Effect.gen(function*() {
      expect(normalCdf(3, 3, 1)).toBeCloseTo(0.5)
    }))
})

describe("Distribution / normalQuantile", () => {
  it.effect("quantile at 0.5 equals mu", () =>
    Effect.gen(function*() {
      expect(normalQuantile(0.5, 5, 2)).toBeCloseTo(5)
    }))
})

describe("Distribution / normalMean", () => {
  it.effect("returns mu", () =>
    Effect.gen(function*() {
      expect(normalMean(7, 3)).toStrictEqual(7)
    }))
})

describe("Distribution / normalVariance", () => {
  it.effect("returns sigma squared", () =>
    Effect.gen(function*() {
      expect(normalVariance(0, 3)).toBeCloseTo(9)
    }))
})

describe("Distribution / normalEntropy", () => {
  it.effect("correct for sigma=1", () =>
    Effect.gen(function*() {
      const expected = 1.4189385332046727
      expect(normalEntropy(0, 1)).toBeCloseTo(expected)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — Beta
// ---------------------------------------------------------------------------

describe("Distribution / betaCdf", () => {
  it.effect("CDF at 0.5 for symmetric (2,2) approximately 0.5", () =>
    Effect.gen(function*() {
      expect(betaCdf(0.5, 2, 2)).toBeCloseTo(0.5)
    }))

  it.effect("preserves NaN outside Number ordering", () =>
    Effect.gen(function*() {
      expect(isNaN(betaPdf(NaN, 2, 2))).toStrictEqual(true)
      expect(isNaN(betaCdf(NaN, 2, 2))).toStrictEqual(true)
    }))
})

describe("Distribution / support checks", () => {
  it.effect("treats NaN as outside uniform and exponential support", () =>
    Effect.gen(function*() {
      expect(uniformPdf(NaN, 0, 1)).toStrictEqual(0)
      expect(exponentialPdf(NaN, 1)).toStrictEqual(0)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — Categorical
// ---------------------------------------------------------------------------

describe("Distribution / categoricalPmf", () => {
  it.effect("returns correct probability", () =>
    Effect.gen(function*() {
      const probs = Chunk.make(0.2, 0.3, 0.5)
      expect(categoricalPmf(1, probs)).toBeCloseTo(0.3)
    }))

  it.effect("returns 0 out of range", () =>
    Effect.gen(function*() {
      const probs = Chunk.make(0.2, 0.3, 0.5)
      expect(categoricalPmf(5, probs)).toStrictEqual(0)
    }))
})

// ---------------------------------------------------------------------------
// Schema-validated operations
// ---------------------------------------------------------------------------

describe("Distribution / normalPdfValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfValidated({ x: 0, mu: 0, sigma: 1 })
      const expected = Number.unsafeDivide(1, sqrt(Number.multiply(2, pi)))
      expect(result).toBeCloseTo(expected)
    }))

  it.effect("rejects excess properties with DistributionDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfValidated({ x: 0, mu: 0, sigma: 1, extra: true })
      )
      expect(error._tag).toStrictEqual("DistributionDecodeError")
      expect(error.operation).toStrictEqual("normalPdf")
    }))

  it.effect("rejects sigma <= 0", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfValidated({ x: 0, mu: 0, sigma: 0 })
      )
      expect(error._tag).toStrictEqual("DistributionDecodeError")
    }))
})

describe("Distribution / normalCdfValidated", () => {
  it.effect("CDF at mean equals 0.5", () =>
    Effect.gen(function*() {
      const result = yield* normalCdfValidated({ x: 5, mu: 5, sigma: 2 })
      expect(result).toBeCloseTo(0.5)
    }))
})

describe("Distribution / normalQuantileValidated", () => {
  it.effect("returns mu for p=0.5", () =>
    Effect.gen(function*() {
      const result = yield* normalQuantileValidated({ p: 0.5, mu: 3, sigma: 2 })
      expect(result).toBeCloseTo(3)
    }))
})

describe("Distribution / uniformPdfValidated", () => {
  it.effect("returns correct density", () =>
    Effect.gen(function*() {
      const result = yield* uniformPdfValidated({ x: 0.5, low: 0, high: 1 })
      expect(result).toBeCloseTo(1)
    }))

  it.effect("rejects low >= high with DistributionParameterError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        uniformPdfValidated({ x: 0.5, low: 1, high: 0 })
      )
      expect(error._tag).toStrictEqual("DistributionParameterError")
      expect(error.operation).toStrictEqual("uniformPdf")
    }))
})

describe("Distribution / betaCdfValidated", () => {
  it.effect("returns valid CDF value", () =>
    Effect.gen(function*() {
      const result = yield* betaCdfValidated({ x: 0.5, alpha: 2, beta: 2 })
      expect(result).toBeCloseTo(0.5)
    }))
})

describe("Distribution / categoricalPmfValidated", () => {
  it.effect("returns correct PMF", () =>
    Effect.gen(function*() {
      const result = yield* categoricalPmfValidated({ k: 1, probs: Array.make(0.2, 0.3, 0.5) })
      expect(result).toBeCloseTo(0.3)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Distribution / normalPdfWithPolicies", () => {
  it.effect("computes under strict", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfWithPolicies(0, 0, 1)
      const expected = Number.unsafeDivide(1, sqrt(Number.multiply(2, pi)))
      expect(result).toBeCloseTo(expected)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("rejects non-finite under strict", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfWithPolicies(0, 0, 5e-324)
      )
      expect(error._tag).toStrictEqual("DistributionDomainViolationError")
      expect(error.operation).toStrictEqual("normalPdfWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("allows non-finite under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfWithPolicies(0, 0, 5e-324)
      expect(isFinite(result)).toStrictEqual(false)
    }).pipe(Effect.provide(relaxedLayer)))
})

describe("Distribution / normalCdfWithPolicies", () => {
  it.effect("CDF at mean equals 0.5 under strict", () =>
    Effect.gen(function*() {
      const result = yield* normalCdfWithPolicies(0, 0, 1)
      expect(result).toBeCloseTo(0.5)
    }).pipe(Effect.provide(strictLayer)))
})

describe("Distribution / betaCdfWithPolicies", () => {
  it.effect("valid CDF under strict", () =>
    Effect.gen(function*() {
      const result = yield* betaCdfWithPolicies(0.5, 2, 2)
      expect(result).toBeCloseTo(0.5)
    }).pipe(Effect.provide(strictLayer)))
})
