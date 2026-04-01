import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number as N, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  entropyValidated,
  entropyWithPolicies,
  normalCdf,
  normalCdfValidated,
  normalCdfWithPolicies,
  normalPdf,
  normalPdfValidated,
  normalPdfWithPolicies,
  shannonEntropy,
  standardNormalCdf,
  standardNormalPdf,
  standardNormalTransform,
  uniformCdf,
  uniformCdfValidated,
  uniformCdfWithPolicies,
  uniformPdf,
  uniformPdfValidated,
  uniformPdfWithPolicies
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

describe("Probability / standardNormalTransform", () => {
  it.effect("maps 0.5 to zero", () =>
    Effect.gen(function*() {
      expect(standardNormalTransform(0.5)).toBeCloseTo(0, 12)
    }))

  it.effect("inverts standardNormalCdf for representative quantiles", () =>
    Effect.gen(function*() {
      const probes = [0.1, 0.25, 0.9]

      probes.forEach((probe) => {
        const roundTrip = standardNormalCdf(standardNormalTransform(probe))
        expect(roundTrip).toBeCloseTo(probe, 6)
      })
    }))

  it.effect("clamps endpoint rolls to finite values", () =>
    Effect.gen(function*() {
      expect(Number.isFinite(standardNormalTransform(0))).toStrictEqual(true)
      expect(Number.isFinite(standardNormalTransform(1))).toStrictEqual(true)
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
// Schema-validated operations
// ---------------------------------------------------------------------------

describe("Probability / normalPdfValidated", () => {
  it.effect("decodes valid input and computes normal PDF", () =>
    Effect.gen(function*() {
      const result = yield* normalPdfValidated({ x: 0, mu: 0, sigma: 1 })
      const expected = N.unsafeDivide(1, Math.sqrt(N.multiply(2, Math.PI)))
      expect(result).toBeCloseTo(expected)
    }))

  it.effect("rejects excess properties with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfValidated({ x: 0, mu: 0, sigma: 1, extra: true })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
      expect(error.operation).toStrictEqual("normalPdf")
    }))

  it.effect("rejects non-finite input with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfValidated({ x: Infinity, mu: 0, sigma: 1 })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
    }))

  it.effect("rejects sigma <= 0 with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normalPdfValidated({ x: 0, mu: 0, sigma: 0 })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
    }))
})

describe("Probability / normalCdfValidated", () => {
  it.effect("CDF at mean equals 0.5", () =>
    Effect.gen(function*() {
      const result = yield* normalCdfValidated({ x: 5, mu: 5, sigma: 2 })
      expect(result).toBeCloseTo(0.5)
    }))
})

describe("Probability / uniformPdfValidated", () => {
  it.effect("decodes valid input and computes uniform PDF", () =>
    Effect.gen(function*() {
      const result = yield* uniformPdfValidated({ x: 0.5, low: 0, high: 1 })
      expect(result).toBeCloseTo(1)
    }))

  it.effect("rejects low >= high with ProbabilityParameterError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        uniformPdfValidated({ x: 0.5, low: 1, high: 0 })
      )
      expect(error._tag).toStrictEqual("ProbabilityParameterError")
      expect(error.operation).toStrictEqual("uniformPdf")
    }))
})

describe("Probability / uniformCdfValidated", () => {
  it.effect("CDF at midpoint equals 0.5", () =>
    Effect.gen(function*() {
      const result = yield* uniformCdfValidated({ x: 0.5, low: 0, high: 1 })
      expect(result).toBeCloseTo(0.5)
    }))

  it.effect("rejects low >= high with ProbabilityParameterError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        uniformCdfValidated({ x: 0.5, low: 5, high: 5 })
      )
      expect(error._tag).toStrictEqual("ProbabilityParameterError")
      expect(error.operation).toStrictEqual("uniformCdf")
    }))
})

describe("Probability / entropyValidated", () => {
  it.effect("computes entropy of uniform distribution", () =>
    Effect.gen(function*() {
      const result = yield* entropyValidated({ probabilities: [0.25, 0.25, 0.25, 0.25] })
      expect(result).toBeCloseTo(Math.log(4))
    }))

  it.effect("rejects excess properties with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        entropyValidated({ probabilities: [0.5, 0.5], extra: true })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
      expect(error.operation).toStrictEqual("entropy")
    }))

  it.effect("rejects negative probabilities with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        entropyValidated({ probabilities: [-0.5, 1.5] })
      )
      expect(error._tag).toStrictEqual("ProbabilityDecodeError")
    }))

  it.effect("rejects empty array with ProbabilityDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        entropyValidated({ probabilities: [] })
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

describe("Probability / normalCdfWithPolicies", () => {
  it.effect("CDF at mean equals 0.5 under strict", () =>
    Effect.gen(function*() {
      const result = yield* normalCdfWithPolicies(0, 0, 1)
      expect(result).toBeCloseTo(0.5)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("CDF at mean equals 0.5 under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* normalCdfWithPolicies(3, 3, 1)
      expect(result).toBeCloseTo(0.5)
    }).pipe(Effect.provide(relaxedLayer)))
})

describe("Probability / uniformPdfWithPolicies", () => {
  it.effect("returns 1/(high-low) inside bounds under strict", () =>
    Effect.gen(function*() {
      const result = yield* uniformPdfWithPolicies(0.5, 0, 1)
      expect(result).toBeCloseTo(1)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("returns 0 outside bounds under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* uniformPdfWithPolicies(-0.1, 0, 1)
      expect(result).toStrictEqual(0)
    }).pipe(Effect.provide(relaxedLayer)))
})

describe("Probability / uniformCdfWithPolicies", () => {
  it.effect("returns 0.5 at midpoint under strict", () =>
    Effect.gen(function*() {
      const result = yield* uniformCdfWithPolicies(0.5, 0, 1)
      expect(result).toBeCloseTo(0.5)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("returns 1 above upper bound under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* uniformCdfWithPolicies(2, 0, 1)
      expect(result).toStrictEqual(1)
    }).pipe(Effect.provide(relaxedLayer)))
})

describe("Probability / entropyWithPolicies", () => {
  it.effect("entropy of uniform distribution equals ln(n) under strict", () =>
    Effect.gen(function*() {
      const result = yield* entropyWithPolicies(Chunk.fromIterable([0.25, 0.25, 0.25, 0.25]))
      expect(result).toBeCloseTo(Math.log(4))
    }).pipe(Effect.provide(strictLayer)))

  it.effect("entropy of fair coin equals ln(2) under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* entropyWithPolicies(Chunk.fromIterable([0.5, 0.5]))
      expect(result).toBeCloseTo(Math.log(2))
    }).pipe(Effect.provide(relaxedLayer)))
})
