import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Number as N, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  beta,
  betaValidated,
  digamma,
  digammaValidated,
  erf,
  erfc,
  erfcValidated,
  erfValidated,
  erfWithPolicies,
  gamma,
  gammaValidated,
  gammaWithPolicies,
  lnGamma,
  lnGammaValidated
} from "../../src/Special/operations.js"

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const KERNEL_TOLERANCE = 1e-10
const DIGAMMA_TOLERANCE = 1e-11

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

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
      expectClose(gamma(0.5), Math.sqrt(Math.PI), KERNEL_TOLERANCE)
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
      expect(Number.isFinite(result)).toBe(true)
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
      expect(Math.abs(N.subtract(beta(0.5, 0.5), Math.PI))).toBeLessThan(1e-10)
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
      expect(Math.abs(N.subtract(erf(4), 1))).toBeLessThan(1e-7)
    }))
})

describe("Special / erfc", () => {
  it.effect("erfc(0) = 1", () =>
    Effect.gen(function*() {
      expect(erfc(0)).toStrictEqual(1)
    }))

  it.effect("erf(x) + erfc(x) = 1", () =>
    Effect.gen(function*() {
      expect(Math.abs(N.subtract(N.sum(erf(1), erfc(1)), 1))).toBeLessThan(1e-15)
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
      expect(Number.isFinite(result)).toBe(false)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / erfWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* erfWithPolicies(0)
      expect(result).toStrictEqual(0) // erf(0) is exactly 0 by special-case
    }).pipe(Effect.provide(strictTypedArrayLayer)))
})
