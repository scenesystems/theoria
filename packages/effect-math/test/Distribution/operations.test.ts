import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, FastCheck, Number, Predicate, Schema } from "effect"

import {
  betaCdf,
  betaCdfValidated,
  betaCdfWithPolicies,
  betaLogpdf,
  betaPdf,
  betaQuantile,
  categoricalPmf,
  categoricalPmfValidated,
  exponentialPdf,
  gammaCdf,
  gammaLogpdf,
  gammaPdf,
  gammaQuantile,
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
  standardNormalCdf,
  standardNormalPdf,
  standardNormalTransform,
  uniformCdfValidated,
  uniformCdfWithPolicies,
  uniformPdf,
  uniformPdfValidated,
  uniformPdfWithPolicies
} from "../../src/Distribution.js"
import { abs, isFinite, pi, sqrt } from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"

const strictLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "enabled"
})

const relaxedLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const isNaN = Predicate.not(Schema.is(Schema.NonNaN))

const expectRelativeClose = (actual: number, expected: number, absolute: number, relative: number) =>
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(
    Number.max(absolute, Number.multiply(abs(expected), relative))
  )

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

  it.effect.prop("is symmetric around every finite location", {
    mu: FastCheck.double({ min: -100, max: 100, noNaN: true }),
    offset: FastCheck.double({ min: -20, max: 20, noNaN: true }),
    sigma: FastCheck.double({ min: 0.1, max: 10, noNaN: true })
  }, ({ mu, offset, sigma }) =>
    Effect.gen(function*() {
      expect(normalPdf(Number.sum(mu, offset), mu, sigma)).toBeCloseTo(
        normalPdf(Number.subtract(mu, offset), mu, sigma),
        14
      )
    }))
})

describe("Distribution / standard normal", () => {
  it.effect("retains the standard density and CDF identities", () =>
    Effect.gen(function*() {
      expect(standardNormalPdf(0)).toBeCloseTo(0.3989422804014327, 15)
      expect(standardNormalCdf(0)).toBe(0.5)
    }))

  it.effect("preserves deterministic transform clamping and tail asymmetry", () =>
    Effect.gen(function*() {
      const below = standardNormalTransform(-1)
      const lowerEndpoint = standardNormalTransform(0)
      const upperEndpoint = standardNormalTransform(1)
      const above = standardNormalTransform(2)
      expect(below).toBe(lowerEndpoint)
      expect(above).toBe(upperEndpoint)
      expect(isFinite(lowerEndpoint)).toBe(true)
      expect(isFinite(upperEndpoint)).toBe(true)
      expect(lowerEndpoint).toBeLessThan(0)
      expect(upperEndpoint).toBeGreaterThan(0)
    }))

  it.effect("inverts accumulated normal probabilities at representative quantiles", () =>
    Effect.forEach(Array.make(0.1, 0.25, 0.9), (probability) =>
      Effect.sync(() => {
        expect(standardNormalCdf(standardNormalTransform(probability))).toBeCloseTo(probability, 6)
      })))
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

describe("Distribution / beta boundaries and quantiles", () => {
  it.effect("matches SciPy endpoint densities and log-densities", () =>
    Effect.gen(function*() {
      expect(betaPdf(0, 0.5, 2)).toBe(Infinity)
      expect(betaLogpdf(0, 0.5, 2)).toBe(Infinity)
      expect(betaPdf(0, 1, 2)).toBeCloseTo(2, 14)
      expect(betaLogpdf(0, 1, 2)).toBeCloseTo(0.6931471805599453, 14)
      expect(betaPdf(0, 2, 2)).toBe(0)
      expect(betaLogpdf(0, 2, 2)).toBe(-Infinity)
      expect(betaPdf(1, 2, 0.5)).toBe(Infinity)
      expect(betaLogpdf(1, 2, 0.5)).toBe(Infinity)
      expect(betaPdf(1, 2, 1)).toBeCloseTo(2, 14)
      expect(betaLogpdf(1, 2, 1)).toBeCloseTo(0.6931471805599453, 14)
      expect(betaPdf(1, 2, 2)).toBe(0)
      expect(betaLogpdf(1, 2, 2)).toBe(-Infinity)
    }))

  it.effect("returns exact support endpoints", () =>
    Effect.gen(function*() {
      expect(betaQuantile(0, 0.25, 7)).toBe(0)
      expect(betaQuantile(1, 0.25, 7)).toBe(1)
      expect(isNaN(betaQuantile(NaN, 0.25, 7))).toBe(true)
    }))

  it.effect("matches independent SciPy asymmetric-tail quantiles", () =>
    Effect.gen(function*() {
      // scipy.stats.beta.ppf references, independently regenerated with SciPy 1.17.1.
      expect(betaQuantile(1e-100, 0.25, 7)).toBe(0)
      expectRelativeClose(betaQuantile(1e-12, 0.25, 7), 1.0179194531881778e-49, 1e-60, 2e-10)
      expectRelativeClose(betaQuantile(1e-9, 8, 0.4), 0.09635597439355893, 1e-13, 2e-10)
      expectRelativeClose(betaQuantile(0.999999, 2, 40), 0.33785169555360606, 1e-13, 2e-10)
      expectRelativeClose(betaQuantile(0.25, 40, 2), 0.9356681378061018, 1e-13, 2e-10)
      expectRelativeClose(betaQuantile(0.999999999, 0.4, 8), 0.9036440259447015, 1e-13, 2e-9)
    }))

  it.effect.prop(
    "round-trips seeded interior probabilities for asymmetric shapes",
    {
      p: FastCheck.double({ min: 1e-5, max: Number.subtract(1, 1e-5), noNaN: true }),
      alpha: FastCheck.double({ min: 0.5, max: 20, noNaN: true }),
      beta: FastCheck.double({ min: 0.5, max: 20, noNaN: true })
    },
    ({ alpha, beta, p }) =>
      Effect.sync(() => {
        expect(abs(Number.subtract(betaCdf(betaQuantile(p, alpha, beta), alpha, beta), p))).toBeLessThanOrEqual(1e-9)
      }),
    { fastCheck: { numRuns: 100, seed: 2903 } }
  )
})

describe("Distribution / gamma boundaries and quantiles", () => {
  it.effect("matches SciPy zero densities and log-densities", () =>
    Effect.gen(function*() {
      expect(gammaPdf(0, 0.5, 2)).toBe(Infinity)
      expect(gammaLogpdf(0, 0.5, 2)).toBe(Infinity)
      expect(gammaPdf(0, 1, 2)).toBe(0.5)
      expect(gammaLogpdf(0, 1, 2)).toBeCloseTo(-0.6931471805599453, 14)
      expect(gammaPdf(0, 2, 2)).toBe(0)
      expect(gammaLogpdf(0, 2, 2)).toBe(-Infinity)
    }))

  it.effect("returns exact support endpoints", () =>
    Effect.gen(function*() {
      expect(gammaQuantile(0, 2, 3)).toBe(0)
      expect(gammaQuantile(1, 2, 3)).toBe(Infinity)
      expect(gammaPdf(Infinity, 2, 3)).toBe(0)
      expect(gammaLogpdf(Infinity, 2, 3)).toBe(-Infinity)
      expect(gammaCdf(Infinity, 2, 3)).toBe(1)
      expect(isNaN(gammaQuantile(NaN, 2, 3))).toBe(true)
    }))

  it.effect("matches independent SciPy lower and upper-tail quantiles", () =>
    Effect.gen(function*() {
      // scipy.stats.gamma.ppf references, independently regenerated with SciPy 1.17.1.
      expect(gammaQuantile(1e-100, 0.25, 3)).toBe(0)
      // P(a,x) ~ x^a / Gamma(a+1): scaling preserves this otherwise underflowed tail.
      expectRelativeClose(gammaQuantile(1e-100, 0.25, 3e100), 2.0249093679335282e-300, 0, 2e-12)
      expectRelativeClose(gammaQuantile(1e-9, 100, 1), 51.14330222883741, 1e-11, 2e-11)
      expectRelativeClose(gammaQuantile(1e-12, 0.25, 3), 2.0249093679335282e-48, 1e-59, 2e-10)
      expectRelativeClose(gammaQuantile(0.999999, 2, 3), 50.06526237248832, 1e-10, 2e-10)
      expectRelativeClose(gammaQuantile(0.999999999, 40, 0.2), 18.048015832241045, 1e-10, 2e-9)
      expectRelativeClose(gammaQuantile(0.25, 80, 4), 295.1975963980082, 1e-10, 2e-10)
    }))

  it.effect.prop(
    "round-trips seeded interior probabilities across shape and scale",
    {
      p: FastCheck.double({ min: 1e-8, max: Number.subtract(1, 1e-8), noNaN: true }),
      scale: FastCheck.double({ min: 0.1, max: 10, noNaN: true }),
      shape: FastCheck.double({ min: 0.2, max: 100, noNaN: true })
    },
    ({ p, scale, shape }) =>
      Effect.sync(() => {
        expect(abs(Number.subtract(gammaCdf(gammaQuantile(p, shape, scale), shape, scale), p)))
          .toBeLessThanOrEqual(2e-10)
      }),
    { fastCheck: { numRuns: 100, seed: 2909 } }
  )
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

describe("Distribution / uniformCdfValidated", () => {
  it.effect("returns the midpoint probability for ordered bounds", () =>
    Effect.gen(function*() {
      expect(yield* uniformCdfValidated({ x: 3, low: 2, high: 4 })).toBe(0.5)
    }))

  it.effect("rejects equal bounds with DistributionParameterError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(uniformCdfValidated({ x: 2, low: 2, high: 2 }))
      expect(error._tag).toBe("DistributionParameterError")
      expect(error.operation).toBe("uniformCdf")
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

describe("Distribution / uniform policies", () => {
  it.effect("evaluates PDF and CDF under strict precision", () =>
    Effect.gen(function*() {
      expect(yield* uniformPdfWithPolicies(3, 2, 6)).toBe(0.25)
      expect(yield* uniformCdfWithPolicies(4, 2, 6)).toBe(0.5)
    }).pipe(Effect.provide(strictLayer)))
})

describe("Distribution / betaCdfWithPolicies", () => {
  it.effect("valid CDF under strict", () =>
    Effect.gen(function*() {
      const result = yield* betaCdfWithPolicies(0.5, 2, 2)
      expect(result).toBeCloseTo(0.5)
    }).pipe(Effect.provide(strictLayer)))
})
