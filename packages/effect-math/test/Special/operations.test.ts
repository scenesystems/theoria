import { describe, expect, it } from "@effect/vitest"
import { Effect, Number } from "effect"

import { abs, isFinite, pi, sqrt } from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"
import {
  beta,
  betaValidated,
  betaWithPolicies,
  digamma,
  digammaValidated,
  digammaWithPolicies,
  erf,
  erfc,
  erfcValidated,
  erfcWithPolicies,
  erfValidated,
  erfWithPolicies,
  gamma,
  gammaValidated,
  gammaWithPolicies,
  lnGamma,
  lnGammaValidated,
  lnGammaWithPolicies
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
const digammaTolerance = 1e-11
const erfBoundaryTolerance = 2e-15

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — gamma
// ---------------------------------------------------------------------------

describe("Special / gamma", () => {
  it.effect("Γ(1) ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(gamma(1), 1, kernelTolerance)
    }))

  it.effect("Γ(5) ≈ 24", () =>
    Effect.gen(function*() {
      expectClose(gamma(5), 24, kernelTolerance)
    }))

  it.effect("Γ(0.5) ≈ √π", () =>
    Effect.gen(function*() {
      expectClose(gamma(0.5), sqrt(pi), kernelTolerance)
    }))

  it.effect("Γ(2) ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(gamma(2), 1, kernelTolerance)
    }))

  it.effect("satisfies the half-integer reflection and recurrence identities", () =>
    Effect.gen(function*() {
      const sqrtPi = sqrt(pi)

      expectClose(gamma(-0.5), Number.multiply(-2, sqrtPi), kernelTolerance)
      expectClose(gamma(-1.5), Number.unsafeDivide(Number.multiply(4, sqrtPi), 3), kernelTolerance)
    }))

  it.effect("satisfies recurrence on both sides of the reflection boundary", () =>
    Effect.gen(function*() {
      const belowBoundary = 0.499999999999
      const aboveBoundary = 0.500000000001

      expectClose(
        gamma(belowBoundary),
        Number.unsafeDivide(gamma(Number.sum(belowBoundary, 1)), belowBoundary),
        kernelTolerance
      )
      expectClose(
        gamma(aboveBoundary),
        Number.unsafeDivide(gamma(Number.sum(aboveBoundary, 1)), aboveBoundary),
        kernelTolerance
      )
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — lnGamma
// ---------------------------------------------------------------------------

describe("Special / lnGamma", () => {
  it.effect("ln(Γ(1)) = 0", () =>
    Effect.gen(function*() {
      expect(lnGamma(1)).toStrictEqual(0)
    }))

  it.effect("ln(Γ(100)) is finite and positive", () =>
    Effect.gen(function*() {
      const result = lnGamma(100)
      expect(isFinite(result)).toBe(true)
      expect(result).toBeGreaterThan(0)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — beta
// ---------------------------------------------------------------------------

describe("Special / beta", () => {
  it.effect("B(1,1) = 1", () =>
    Effect.gen(function*() {
      expect(beta(1, 1)).toStrictEqual(1)
    }))

  it.effect("B(0.5,0.5) ≈ π", () =>
    Effect.gen(function*() {
      expect(abs(Number.subtract(beta(0.5, 0.5), pi))).toBeLessThan(1e-10)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — erf / erfc
// ---------------------------------------------------------------------------

describe("Special / erf", () => {
  it.effect("erf(0) = 0", () =>
    Effect.gen(function*() {
      expect(erf(0)).toStrictEqual(0)
    }))

  it.effect("erf is odd: erf(-x) = -erf(x)", () =>
    Effect.gen(function*() {
      expect(erf(-1)).toStrictEqual(Number.subtract(0, erf(1)))
    }))

  it.effect("erf(large) ≈ 1", () =>
    Effect.gen(function*() {
      expect(abs(Number.subtract(erf(4), 1))).toBeLessThan(1e-7)
    }))

  it.effect("matches SciPy reference values at every approximation boundary", () =>
    Effect.gen(function*() {
      const twoPowNegative28 = Number.unsafeDivide(1, 268_435_456)
      const largeSplit = Number.unsafeDivide(1, 0.35)

      expectClose(erf(twoPowNegative28), 4.203539964167448e-9, erfBoundaryTolerance)
      expectClose(erf(0.84375), 0.7672256612323416, erfBoundaryTolerance)
      expectClose(erf(1.25), 0.9229001282564582, erfBoundaryTolerance)
      expectClose(erf(largeSplit), 0.9999466876886117, erfBoundaryTolerance)
      expectClose(erf(6), 1, erfBoundaryTolerance)
    }))

  it.effect("preserves signed zero, NaN, and infinity behavior", () =>
    Effect.gen(function*() {
      expect(erf(-0)).toBe(0)
      expect(erf(Number.unsafeDivide(0, 0))).toBeNaN()
      expect(erf(Number.unsafeDivide(1, 0))).toBe(1)
      expect(erf(Number.unsafeDivide(-1, 0))).toBe(-1)
    }))
})

describe("Special / erfc", () => {
  it.effect("erfc(0) = 1", () =>
    Effect.gen(function*() {
      expect(erfc(0)).toStrictEqual(1)
    }))

  it.effect("erf(x) + erfc(x) = 1", () =>
    Effect.gen(function*() {
      expect(abs(Number.subtract(Number.sum(erf(1), erfc(1)), 1))).toBeLessThan(1e-15)
    }))

  it.effect("matches SciPy reference values at every approximation boundary", () =>
    Effect.gen(function*() {
      const twoPowNegative28 = Number.unsafeDivide(1, 268_435_456)
      const largeSplit = Number.unsafeDivide(1, 0.35)

      expectClose(erfc(twoPowNegative28), 0.99999999579646, erfBoundaryTolerance)
      expectClose(erfc(0.84375), 0.2327743387676584, erfBoundaryTolerance)
      expectClose(erfc(1.25), 0.07709987174354177, erfBoundaryTolerance)
      expectClose(erfc(largeSplit), 5.3312311388322815e-5, erfBoundaryTolerance)
      expectClose(erfc(6), 2.1519736712498913e-17, 1e-30)
    }))

  it.effect("preserves signed zero, NaN, and infinity behavior", () =>
    Effect.gen(function*() {
      expect(erfc(-0)).toBe(1)
      expect(erfc(Number.unsafeDivide(0, 0))).toBeNaN()
      expect(erfc(Number.unsafeDivide(1, 0))).toBe(0)
      expect(erfc(Number.unsafeDivide(-1, 0))).toBe(2)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — digamma
// ---------------------------------------------------------------------------

describe("Special / digamma", () => {
  it.effect("ψ(1) ≈ -γ (Euler–Mascheroni)", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      expectClose(digamma(1), Number.negate(eulerMascheroni), digammaTolerance)
    }))

  it.effect("ψ(2) ≈ 1 - γ", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      expectClose(digamma(2), Number.subtract(1, eulerMascheroni), digammaTolerance)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Special / gammaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* gammaValidated({ x: 5 })
      expectClose(result, 24, kernelTolerance)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(gammaValidated({ x: 5, extra: true }))
      expect(error._tag).toStrictEqual("SpecialDecodeError")
      expect(error.operation).toStrictEqual("gamma")
    }))
})

describe("Special / lnGammaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* lnGammaValidated({ x: 1 })
      expectClose(result, 0, kernelTolerance)
    }))
})

describe("Special / betaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* betaValidated({ a: 1, b: 1 })
      expectClose(result, 1, kernelTolerance)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(betaValidated({ a: 1, b: 1, extra: true }))
      expect(error._tag).toStrictEqual("SpecialDecodeError")
      expect(error.operation).toStrictEqual("beta")
    }))
})

describe("Special / erfValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* erfValidated({ x: 0 })
      expect(result).toStrictEqual(0)
    }))
})

describe("Special / erfcValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* erfcValidated({ x: 0 })
      expect(result).toStrictEqual(1)
    }))
})

describe("Special / digammaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* digammaValidated({ x: 1 })
      const eulerMascheroni = 0.5772156649015329
      expectClose(result, Number.negate(eulerMascheroni), digammaTolerance)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Special / gammaWithPolicies", () => {
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const result = yield* gammaWithPolicies(5)
      expectClose(result, 24, kernelTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* gammaWithPolicies(5)
      expectClose(result, 24, kernelTolerance)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict rejects non-finite result", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(gammaWithPolicies(0))
      expect(error._tag).toStrictEqual("SpecialDomainViolationError")
      expect(error.operation).toStrictEqual("gammaWithPolicies")
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("relaxed passes through non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* gammaWithPolicies(0)
      expect(isFinite(result)).toBe(false)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / erfWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* erfWithPolicies(0)
      expect(result).toStrictEqual(0) // erf(0) is exactly 0 by special-case
    }).pipe(Effect.provide(strictCompensatedLayer)))
})

describe("Special / lnGammaWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* lnGammaWithPolicies(1)
      expectClose(result, 0, kernelTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns finite result for large input under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* lnGammaWithPolicies(100)
      expect(isFinite(result)).toBe(true)
      expect(result).toBeGreaterThan(0)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / betaWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* betaWithPolicies(1, 1)
      expectClose(result, 1, kernelTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns B(0.5,0.5) ≈ π under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* betaWithPolicies(0.5, 0.5)
      expectClose(result, pi, kernelTolerance)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / erfcWithPolicies", () => {
  it.effect("returns erfc(0) = 1 under strict", () =>
    Effect.gen(function*() {
      const result = yield* erfcWithPolicies(0)
      expect(result).toStrictEqual(1)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* erfcWithPolicies(1)
      expect(abs(Number.subtract(Number.sum(result, erf(1)), 1))).toBeLessThan(1e-15)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / digammaWithPolicies", () => {
  it.effect("returns ψ(1) ≈ -γ under strict", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      const result = yield* digammaWithPolicies(1)
      expectClose(result, Number.negate(eulerMascheroni), digammaTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns ψ(2) ≈ 1 - γ under relaxed", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      const result = yield* digammaWithPolicies(2)
      expectClose(result, Number.subtract(1, eulerMascheroni), digammaTolerance)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
