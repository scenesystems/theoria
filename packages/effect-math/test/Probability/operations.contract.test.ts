import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number as N, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  entropyEffect,
  normalCdf,
  normalCdfEffect,
  normalPdf,
  normalPdfEffect,
  normalPdfWithPolicies,
  shannonEntropy,
  standardNormalCdf,
  standardNormalPdf,
  uniformCdf,
  uniformCdfEffect,
  uniformPdf,
  uniformPdfEffect
} from "../../src/Probability/operations.js"

const strictLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "enabled"
})

const relaxedLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

// ---------------------------------------------------------------------------
// Pure kernel operations — Normal distribution
// ---------------------------------------------------------------------------

describe("Probability / standardNormalPdf", () => {
  it.effect("peak value at x=0 equals 1/√(2π)", () =>
    Effect.gen(function*() {
      const expected = N.unsafeDivide(1, Math.sqrt(N.multiply(2, Math.PI)))
      expect(standardNormalPdf(0)).toBeCloseTo(expected)
    }))

  it.effect("symmetric around zero", () =>
    Effect.gen(function*() {
      expect(standardNormalPdf(1)).toBeCloseTo(standardNormalPdf(-1))
    }))
})

describe("Probability / normalPdf", () => {
  it.effect("PDF at mean equals peak value", () =>
    Effect.gen(function*() {
      const mu = 5
      const sigma = 2
      const expected = N.unsafeDivide(1, N.multiply(sigma, Math.sqrt(N.multiply(2, Math.PI))))
      expect(normalPdf(mu, mu, sigma)).toBeCloseTo(expected)
    }))

  it.effect("reduces to standard normal when mu=0 sigma=1", () =>
    Effect.gen(function*() {
      expect(normalPdf(1.5, 0, 1)).toBeCloseTo(standardNormalPdf(1.5))
    }))
})

describe("Probability / standardNormalCdf", () => {
  it.effect("CDF at 0 equals 0.5", () =>
    Effect.gen(function*() {
      expect(standardNormalCdf(0)).toBeCloseTo(0.5)
    }))

  it.effect("CDF approaches 1 for large positive x", () =>
    Effect.gen(function*() {
      expect(standardNormalCdf(6)).toBeCloseTo(1, 5)
    }))

  it.effect("CDF approaches 0 for large negative x", () =>
    Effect.gen(function*() {
      expect(standardNormalCdf(-6)).toBeCloseTo(0, 5)
    }))
})

describe("Probability / normalCdf", () => {
  it.effect("CDF at mean equals 0.5", () =>
    Effect.gen(function*() {
      expect(normalCdf(3, 3, 1)).toBeCloseTo(0.5)
    }))

  it.effect("reduces to standard normal when mu=0 sigma=1", () =>
    Effect.gen(function*() {
      expect(normalCdf(1.5, 0, 1)).toBeCloseTo(standardNormalCdf(1.5))
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — Uniform distribution
// ---------------------------------------------------------------------------

describe("Probability / uniformPdf", () => {
  it.effect("returns 1/(high-low) inside bounds", () =>
    Effect.gen(function*() {
      expect(uniformPdf(0.5, 0, 1)).toBeCloseTo(1)
    }))

  it.effect("returns 0 outside bounds (below)", () =>
    Effect.gen(function*() {
      expect(uniformPdf(-0.1, 0, 1)).toStrictEqual(0)
    }))

  it.effect("returns 0 outside bounds (above)", () =>
    Effect.gen(function*() {
      expect(uniformPdf(1.1, 0, 1)).toStrictEqual(0)
    }))

  it.effect("returns correct density for non-unit interval", () =>
    Effect.gen(function*() {
      expect(uniformPdf(3, 2, 6)).toBeCloseTo(0.25)
    }))
})

describe("Probability / uniformCdf", () => {
  it.effect("returns 0 below lower bound", () =>
    Effect.gen(function*() {
      expect(uniformCdf(-1, 0, 1)).toStrictEqual(0)
    }))

  it.effect("returns 1 above upper bound", () =>
    Effect.gen(function*() {
      expect(uniformCdf(2, 0, 1)).toStrictEqual(1)
    }))

  it.effect("returns 0.5 at midpoint", () =>
    Effect.gen(function*() {
      expect(uniformCdf(0.5, 0, 1)).toBeCloseTo(0.5)
    }))

  it.effect("returns 0 at lower bound", () =>
    Effect.gen(function*() {
      expect(uniformCdf(0, 0, 1)).toBeCloseTo(0)
    }))

  it.effect("returns 1 at upper bound", () =>
    Effect.gen(function*() {
      expect(uniformCdf(1, 0, 1)).toBeCloseTo(1)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — Entropy
// ---------------------------------------------------------------------------

describe("Probability / shannonEntropy", () => {
  it.effect("entropy of uniform distribution equals ln(n)", () =>
    Effect.gen(function*() {
      const n = 4
      const probs = Chunk.fromIterable([0.25, 0.25, 0.25, 0.25])
      expect(shannonEntropy(probs)).toBeCloseTo(Math.log(n))
    }))

  it.effect("entropy of certain outcome is zero", () =>
    Effect.gen(function*() {
      const probs = Chunk.fromIterable([1, 0, 0])
      expect(shannonEntropy(probs)).toBeCloseTo(0)
    }))

  it.effect("entropy of binary fair coin equals ln(2)", () =>
    Effect.gen(function*() {
      const probs = Chunk.fromIterable([0.5, 0.5])
      expect(shannonEntropy(probs)).toBeCloseTo(Math.log(2))
    }))
})

// ---------------------------------------------------------------------------
// Effect-wrapped operations
// ---------------------------------------------------------------------------

describe("Probability / normalPdfEffect", () => {
  it.effect("decodes valid input and computes normal PDF", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfEffect({ x: 0, mu: 0, sigma: 1 })
      const expected = N.unsafeDivide(1, Math.sqrt(N.multiply(2, Math.PI)))
      expect(result).toBeCloseTo(expected)
    }))

  it.effect("rejects excess properties with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfEffect({ x: 0, mu: 0, sigma: 1, extra: true })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
      expect(error.operation).toStrictEqual("normalPdf")
    }))

  it.effect("rejects non-finite input with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfEffect({ x: Infinity, mu: 0, sigma: 1 })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
    }))

  it.effect("rejects sigma <= 0 with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfEffect({ x: 0, mu: 0, sigma: 0 })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
    }))
})

describe("Probability / normalCdfEffect", () => {
  it.effect("CDF at mean equals 0.5", () =>
    Effect.gen(function*() {
      const result = yield* normalCdfEffect({ x: 5, mu: 5, sigma: 2 })
      expect(result).toBeCloseTo(0.5)
    }))
})

describe("Probability / uniformPdfEffect", () => {
  it.effect("decodes valid input and computes uniform PDF", () =>
    Effect.gen(function*() {
      const result = yield* uniformPdfEffect({ x: 0.5, low: 0, high: 1 })
      expect(result).toBeCloseTo(1)
    }))

  it.effect("rejects low >= high with ProbabilityParameterError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        uniformPdfEffect({ x: 0.5, low: 1, high: 0 })
      )
      expect(error._tag).toStrictEqual("ProbabilityParameterError")
      expect(error.operation).toStrictEqual("uniformPdf")
    }))
})

describe("Probability / uniformCdfEffect", () => {
  it.effect("CDF at midpoint equals 0.5", () =>
    Effect.gen(function*() {
      const result = yield* uniformCdfEffect({ x: 0.5, low: 0, high: 1 })
      expect(result).toBeCloseTo(0.5)
    }))

  it.effect("rejects low >= high with ProbabilityParameterError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        uniformCdfEffect({ x: 0.5, low: 5, high: 5 })
      )
      expect(error._tag).toStrictEqual("ProbabilityParameterError")
      expect(error.operation).toStrictEqual("uniformCdf")
    }))
})

describe("Probability / entropyEffect", () => {
  it.effect("computes entropy of uniform distribution", () =>
    Effect.gen(function*() {
      const result = yield* entropyEffect({ probabilities: [0.25, 0.25, 0.25, 0.25] })
      expect(result).toBeCloseTo(Math.log(4))
    }))

  it.effect("rejects excess properties with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        entropyEffect({ probabilities: [0.5, 0.5], extra: true })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
      expect(error.operation).toStrictEqual("entropy")
    }))

  it.effect("rejects negative probabilities with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        entropyEffect({ probabilities: [-0.5, 1.5] })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
    }))

  it.effect("rejects empty array with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        entropyEffect({ probabilities: [] })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Probability / normalPdfWithPolicies", () => {
  it.effect("computes normal PDF under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfWithPolicies(0, 0, 1)
      const expected = N.unsafeDivide(1, Math.sqrt(N.multiply(2, Math.PI)))
      expect(result).toBeCloseTo(expected)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("strict precision rejects non-finite result", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfWithPolicies(0, 0, Number.MIN_VALUE)
      )
      expect(error._tag).toStrictEqual("ProbabilityDomainViolationError")
      expect(error.operation).toStrictEqual("normalPdfWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("relaxed precision allows non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfWithPolicies(0, 0, Number.MIN_VALUE)
      expect(Number.isFinite(result)).toStrictEqual(false)
    }).pipe(Effect.provide(relaxedLayer)))

  it.effect("deterministic replay produces identical results", () =>
    Effect.gen(function*() {
      const runA = yield* normalPdfWithPolicies(1.5, 0, 1).pipe(Effect.provide(strictLayer))
      const runB = yield* normalPdfWithPolicies(1.5, 0, 1).pipe(Effect.provide(strictLayer))
      expect(N.Equivalence(runA, runB)).toStrictEqual(true)
    }))
})
