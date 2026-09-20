import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Number, Tuple } from "effect"

import { abs, exp, expm1 } from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"
import {
  betainc,
  betaincValidated,
  erfcinv,
  erfinv,
  erfinvValidated,
  erfinvWithPolicies,
  gammainc,
  gammaincc,
  gammaincValidated,
  gammaincWithPolicies,
  polygamma,
  polygammaValidated
} from "../../src/Special.js"

const strictCompensatedLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedScalarLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const kernelTolerance = 1e-10
const polygammaTolerance = 1e-10

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — erfinv / erfcinv
// ---------------------------------------------------------------------------

describe("Special / erfinv", () => {
  it.effect("erfinv(0) === 0", () =>
    Effect.gen(function*() {
      expect(erfinv(0)).toStrictEqual(0)
    }))

  it.effect("erfinv(0.5) ≈ 0.4769", () =>
    Effect.gen(function*() {
      expectClose(erfinv(0.5), 0.4769362762044699, kernelTolerance)
    }))

  it.effect("erfinv is odd: erfinv(-x) = -erfinv(x)", () =>
    Effect.gen(function*() {
      expectClose(erfinv(-0.5), Number.negate(erfinv(0.5)), kernelTolerance)
    }))

  it.effect("erfinv(0.99) ≈ 1.8214", () =>
    Effect.gen(function*() {
      expectClose(erfinv(0.99), 1.8213863677184496, kernelTolerance)
    }))
})

describe("Special / erfcinv", () => {
  it.effect("erfcinv(1) ≈ 0", () =>
    Effect.gen(function*() {
      expectClose(erfcinv(1), 0, kernelTolerance)
    }))

  it.effect("erfcinv(0.5) ≈ erfinv(0.5)", () =>
    Effect.gen(function*() {
      expectClose(erfcinv(0.5), erfinv(0.5), kernelTolerance)
    }))

  it.effect("preserves tiny tail arguments and the representable reflection below two", () =>
    Effect.gen(function*() {
      // SciPy special.erfcinv; for the smallest subnormal use
      // -ndtri_exp(log(x)-log(2))/sqrt(2), avoiding SciPy's x/2 underflow.
      Array.forEach(
        Array.make(
          Tuple.make(1e-20, 6.601580622355143),
          Tuple.make(1e-100, 15.065574702592647),
          Tuple.make(1e-300, 26.209469960516124),
          Tuple.make(1e-320, 27.073153719853046),
          Tuple.make(5e-324, 27.213293210812946),
          Tuple.make(1.9999999999999998, -5.805018683193454)
        ),
        ([input, expected]) => expectClose(erfcinv(input), expected, Number.multiply(abs(expected), 8e-16))
      )
    }))

  it.effect("distinguishes endpoints from out-of-domain and NaN arguments", () =>
    Effect.gen(function*() {
      const infinity = Number.unsafeDivide(1, 0)
      expect(erfcinv(0)).toBe(infinity)
      expect(erfcinv(-0)).toBe(infinity)
      expect(erfcinv(2)).toBe(Number.negate(infinity))
      expect(erfcinv(-5e-324)).toBeNaN()
      expect(erfcinv(2.0000000000000004)).toBeNaN()
      expect(erfcinv(infinity)).toBeNaN()
      expect(erfcinv(Number.unsafeDivide(0, 0))).toBeNaN()
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — gammainc / gammaincc
// ---------------------------------------------------------------------------

describe("Special / gammainc", () => {
  it.effect("gammainc(1, 1) ≈ 1 - exp(-1)", () =>
    Effect.gen(function*() {
      expectClose(gammainc(1, 1), Number.subtract(1, exp(-1)), kernelTolerance)
    }))

  it.effect("converges through the series for an integer-shape closed form", () =>
    Effect.gen(function*() {
      // P(2, x) = 1 - exp(-x)(1 + x).
      const expected = Number.subtract(1, Number.multiply(exp(-1), 2))
      expectClose(gammainc(2, 1), expected, 1e-14)
    }))

  it.effect("preserves a tiny lower tail after the fixed series prefix", () =>
    Effect.gen(function*() {
      // P(1, x) = 1 - exp(-x), evaluated without cancellation.
      const x = 1e-12
      expectClose(gammainc(1, x), Number.negate(expm1(Number.negate(x))), 4e-27)
    }))

  it.effect("gammainc(0.5, 1) ≈ 0.8427", () =>
    Effect.gen(function*() {
      expectClose(gammainc(0.5, 1), 0.8427007929497151, kernelTolerance)
    }))

  it.effect("gammainc(1, 10) ≈ 0.99995", () =>
    Effect.gen(function*() {
      expectClose(gammainc(1, 10), 0.9999546000702375, kernelTolerance)
    }))
})

describe("Special / gammaincc", () => {
  it.effect("gammaincc(1, 1) ≈ exp(-1)", () =>
    Effect.gen(function*() {
      expectClose(gammaincc(1, 1), exp(-1), kernelTolerance)
    }))

  it.effect("preserves the complementary tail for an integer shape", () =>
    Effect.gen(function*() {
      // Q(2, x) = exp(-x)(1 + x), an exact finite-sum reference.
      expectClose(gammaincc(2, 40), Number.multiply(exp(-40), 41), 1e-29)
    }))

  it.effect("converges through the continued fraction at the region boundary", () =>
    Effect.gen(function*() {
      // x = a + 1 selects the continued fraction; Q(2, x) = exp(-x)(1 + x).
      expectClose(gammaincc(2, 3), Number.multiply(exp(-3), 4), 1e-14)
    }))

  it.effect("preserves the non-integer continued-fraction recurrence", () =>
    Effect.gen(function*() {
      // scipy.special.gammaincc reference, independently evaluated with SciPy 1.17.1.
      expectClose(gammaincc(3.75, 12), 0.0016310390163441538, 2e-17)
    }))

  it.effect("keeps the continued fraction stable when every numerator is negative", () =>
    Effect.gen(function*() {
      // SciPy 1.17.1 references. Shapes below one make n(a − n) negative
      // from the first iteration; x = a + 1 gives the smallest denominators.
      expectClose(gammaincc(0.125, 1.125), 0.025367388598511103, 4e-16)
      expectClose(gammaincc(1e-8, 1.00000001), 2.1938393296147597e-9, 4e-23)
      expectClose(gammaincc(0.875, 2), 0.10893012448240144, 2e-15)
    }))

  it.effect("gammainc(a, x) + gammaincc(a, x) ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(Number.sum(gammainc(5, 5), gammaincc(5, 5)), 1, kernelTolerance)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — betainc
// ---------------------------------------------------------------------------

describe("Special / betainc", () => {
  it.effect("betainc(a, b, 0) = 0", () =>
    Effect.gen(function*() {
      expectClose(betainc(2, 3, 0), 0, kernelTolerance)
    }))

  it.effect("betainc(a, b, 1) = 1", () =>
    Effect.gen(function*() {
      expectClose(betainc(2, 3, 1), 1, kernelTolerance)
    }))

  it.effect("betainc(1, 1, 0.5) = 0.5", () =>
    Effect.gen(function*() {
      expectClose(betainc(1, 1, 0.5), 0.5, kernelTolerance)
    }))

  it.effect("betainc(2, 3, 0.5) ≈ 0.6875", () =>
    Effect.gen(function*() {
      expectClose(betainc(2, 3, 0.5), 0.6875, kernelTolerance)
    }))

  it.effect("preserves a direct lower tail with b = 1", () =>
    Effect.gen(function*() {
      // I_x(2, 1) = x².
      expectClose(betainc(2, 1, 1e-12), 1e-24, 1e-36)
      // scipy.special.betainc reference, independently regenerated with SciPy 1.17.1.
      expectClose(betainc(0.125, 80, 1e-250), 1.0319452159347026e-31, 1e-43)
    }))

  it.effect("applies reflection without changing the closed-form result", () =>
    Effect.gen(function*() {
      // I_x(1, 2) = 1 - (1 - x)².
      expectClose(betainc(1, 2, 0.875), 0.984375, 1e-14)
    }))

  it.effect("remains stable for concentrated symmetric shapes", () =>
    Effect.gen(function*() {
      // scipy.special.betainc references, independently regenerated with SciPy 1.17.1.
      expectClose(betainc(100, 100, 0.49), 0.3887733080667469, 1e-12)
      expectClose(betainc(1000, 1000, 0.5), 0.4999999999999992, 1e-12)
    }))

  it.effect("converges for small b·x when x is close to one", () =>
    Effect.gen(function*() {
      // SciPy 1.17.1: small b·x alone does not ensure rapid series convergence.
      expectClose(betainc(100, 0.125, 0.98), 0.007233207683938254, 1e-14)
      expectClose(betainc(1000, 0.125, 0.99), 7.076623262007454e-7, 1e-18)
      expectClose(betainc(0.125, 100, 0.02), 0.9927667923160617, 1e-14)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — polygamma
// ---------------------------------------------------------------------------

describe("Special / polygamma", () => {
  it.effect("polygamma(0, 1) ≈ -γ (Euler–Mascheroni)", () =>
    Effect.gen(function*() {
      expectClose(polygamma(0, 1), -0.5772156649015329, polygammaTolerance)
    }))

  it.effect("polygamma(1, 1) ≈ π²/6", () =>
    Effect.gen(function*() {
      expectClose(polygamma(1, 1), 1.6449340668482266, polygammaTolerance)
    }))

  it.effect("polygamma(2, 1) ≈ -2.404", () =>
    Effect.gen(function*() {
      expectClose(polygamma(2, 1), -2.404113806319188, polygammaTolerance)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Special / erfinvValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* erfinvValidated({ x: 0.5 })
      expectClose(result, 0.4769362762044699, kernelTolerance)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(erfinvValidated({ x: 0.5, extra: true }))
      expect(error._tag).toStrictEqual("SpecialDecodeError")
      expect(error.operation).toStrictEqual("erfinv")
    }))
})

describe("Special / gammaincValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* gammaincValidated({ a: 1, x: 1 })
      expectClose(result, Number.subtract(1, exp(-1)), kernelTolerance)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(gammaincValidated({ a: 1, x: 1, extra: true }))
      expect(error._tag).toStrictEqual("SpecialDecodeError")
      expect(error.operation).toStrictEqual("gammainc")
    }))
})

describe("Special / betaincValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* betaincValidated({ a: 2, b: 3, x: 0 })
      expectClose(result, 0, kernelTolerance)
    }))
})

describe("Special / polygammaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* polygammaValidated({ n: 0, x: 1 })
      expectClose(result, -0.5772156649015329, polygammaTolerance)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Special / erfinvWithPolicies", () => {
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const result = yield* erfinvWithPolicies(0.5)
      expectClose(result, 0.4769362762044699, kernelTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* erfinvWithPolicies(0.5)
      expectClose(result, 0.4769362762044699, kernelTolerance)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / gammaincWithPolicies", () => {
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const result = yield* gammaincWithPolicies(1, 1)
      expectClose(result, Number.subtract(1, exp(-1)), kernelTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* gammaincWithPolicies(1, 1)
      expectClose(result, Number.subtract(1, exp(-1)), kernelTolerance)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
