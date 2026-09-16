import { describe, expect, it } from "@effect/vitest"
import { Boolean, Effect, Exit, Number as N, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { abs, pi, sqrt } from "../../src/Numeric/index.js"
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
} from "../../src/Special/operations.js"

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const KERNEL_TOLERANCE = 1e-10
const DIGAMMA_TOLERANCE = 1e-11
const ERF_BOUNDARY_TOLERANCE = 2e-15
const isNonNaN = Schema.is(Schema.NonNaN)

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Pure kernel operations — gamma
// ---------------------------------------------------------------------------

describe("Special / gamma", () => {
  it.effect("Γ(1) ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(gamma(1), 1, KERNEL_TOLERANCE)
    }))

  it.effect("Γ(5) ≈ 24", () =>
    Effect.gen(function*() {
      expectClose(gamma(5), 24, KERNEL_TOLERANCE)
    }))

  it.effect("Γ(0.5) ≈ √π", () =>
    Effect.gen(function*() {
      expectClose(gamma(0.5), sqrt(pi), KERNEL_TOLERANCE)
    }))

  it.effect("Γ(2) ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(gamma(2), 1, KERNEL_TOLERANCE)
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
      expect(Schema.is(Schema.Finite)(result)).toBe(true)
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
      expect(abs(N.subtract(beta(0.5, 0.5), pi))).toBeLessThan(1e-10)
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
      expect(erf(-1)).toStrictEqual(N.subtract(0, erf(1)))
    }))

  it.effect("erf(large) ≈ 1", () =>
    Effect.gen(function*() {
      expect(abs(N.subtract(erf(4), 1))).toBeLessThan(1e-7)
    }))

  it.effect("matches SciPy reference values at every approximation boundary", () =>
    Effect.gen(function*() {
      const twoPowNeg28 = N.unsafeDivide(1, 268_435_456)
      const largeSplit = N.unsafeDivide(1, 0.35)

      expectClose(erf(twoPowNeg28), 4.203539964167448e-9, ERF_BOUNDARY_TOLERANCE)
      expectClose(erf(0.84375), 0.7672256612323416, ERF_BOUNDARY_TOLERANCE)
      expectClose(erf(1.25), 0.9229001282564582, ERF_BOUNDARY_TOLERANCE)
      expectClose(erf(largeSplit), 0.9999466876886117, ERF_BOUNDARY_TOLERANCE)
      expectClose(erf(6), 1, ERF_BOUNDARY_TOLERANCE)
    }))

  it.effect("preserves signed zero, NaN, and infinity behavior", () =>
    Effect.gen(function*() {
      expect(erf(-0)).toBe(0)
      expect(Boolean.not(isNonNaN(erf(Number.NaN)))).toBe(true)
      expect(erf(Number.POSITIVE_INFINITY)).toBe(1)
      expect(erf(Number.NEGATIVE_INFINITY)).toBe(-1)
    }))
})

describe("Special / erfc", () => {
  it.effect("erfc(0) = 1", () =>
    Effect.gen(function*() {
      expect(erfc(0)).toStrictEqual(1)
    }))

  it.effect("erf(x) + erfc(x) = 1", () =>
    Effect.gen(function*() {
      expect(abs(N.subtract(N.sum(erf(1), erfc(1)), 1))).toBeLessThan(1e-15)
    }))

  it.effect("matches SciPy reference values at every approximation boundary", () =>
    Effect.gen(function*() {
      const twoPowNeg28 = N.unsafeDivide(1, 268_435_456)
      const largeSplit = N.unsafeDivide(1, 0.35)

      expectClose(erfc(twoPowNeg28), 0.99999999579646, ERF_BOUNDARY_TOLERANCE)
      expectClose(erfc(0.84375), 0.2327743387676584, ERF_BOUNDARY_TOLERANCE)
      expectClose(erfc(1.25), 0.07709987174354177, ERF_BOUNDARY_TOLERANCE)
      expectClose(erfc(largeSplit), 5.3312311388322815e-5, ERF_BOUNDARY_TOLERANCE)
      expectClose(erfc(6), 2.1519736712498913e-17, 1e-30)
    }))

  it.effect("preserves signed zero, NaN, and infinity behavior", () =>
    Effect.gen(function*() {
      expect(erfc(-0)).toBe(1)
      expect(Boolean.not(isNonNaN(erfc(Number.NaN)))).toBe(true)
      expect(erfc(Number.POSITIVE_INFINITY)).toBe(0)
      expect(erfc(Number.NEGATIVE_INFINITY)).toBe(2)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — digamma
// ---------------------------------------------------------------------------

describe("Special / digamma", () => {
  it.effect("ψ(1) ≈ -γ (Euler–Mascheroni)", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      expectClose(digamma(1), N.negate(eulerMascheroni), DIGAMMA_TOLERANCE)
    }))

  it.effect("ψ(2) ≈ 1 - γ", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      expectClose(digamma(2), N.subtract(1, eulerMascheroni), DIGAMMA_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Special / gammaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* gammaValidated({ x: 5 })
      expectClose(result, 24, KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(gammaValidated({ x: 5, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Special / lnGammaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* lnGammaValidated({ x: 1 })
      expectClose(result, 0, KERNEL_TOLERANCE)
    }))
})

describe("Special / betaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* betaValidated({ a: 1, b: 1 })
      expectClose(result, 1, KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(betaValidated({ a: 1, b: 1, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
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
      expectClose(result, N.negate(eulerMascheroni), DIGAMMA_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Special / gammaWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const result = yield* gammaWithPolicies(5)
      expectClose(result, 24, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* gammaWithPolicies(5)
      expectClose(result, 24, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict rejects non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(gammaWithPolicies(0))
      expect(Exit.isFailure(result)).toBe(true)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed passes through non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* gammaWithPolicies(0)
      expect(Schema.is(Schema.Finite)(result)).toBe(false)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / erfWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* erfWithPolicies(0)
      expect(result).toStrictEqual(0) // erf(0) is exactly 0 by special-case
    }).pipe(Effect.provide(strictTypedArrayLayer)))
})

describe("Special / lnGammaWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* lnGammaWithPolicies(1)
      expectClose(result, 0, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns finite result for large input under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* lnGammaWithPolicies(100)
      expect(Schema.is(Schema.Finite)(result)).toBe(true)
      expect(result).toBeGreaterThan(0)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / betaWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* betaWithPolicies(1, 1)
      expectClose(result, 1, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns B(0.5,0.5) ≈ π under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* betaWithPolicies(0.5, 0.5)
      expectClose(result, pi, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / erfcWithPolicies", () => {
  it.effect("returns erfc(0) = 1 under strict", () =>
    Effect.gen(function*() {
      const result = yield* erfcWithPolicies(0)
      expect(result).toStrictEqual(1)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* erfcWithPolicies(1)
      expect(abs(N.subtract(N.sum(result, erf(1)), 1))).toBeLessThan(1e-15)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / digammaWithPolicies", () => {
  it.effect("returns ψ(1) ≈ -γ under strict", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      const result = yield* digammaWithPolicies(1)
      expectClose(result, N.negate(eulerMascheroni), DIGAMMA_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns ψ(2) ≈ 1 - γ under relaxed", () =>
    Effect.gen(function*() {
      const eulerMascheroni = 0.5772156649015329
      const result = yield* digammaWithPolicies(2)
      expectClose(result, N.subtract(1, eulerMascheroni), DIGAMMA_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
