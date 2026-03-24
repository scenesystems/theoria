import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Number as N, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
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
const POLYGAMMA_TOLERANCE = 1e-10

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

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
      expectClose(erfinv(0.5), 0.4769362762044699, KERNEL_TOLERANCE)
    }))

  it.effect("erfinv is odd: erfinv(-x) = -erfinv(x)", () =>
    Effect.gen(function*() {
      expectClose(erfinv(-0.5), N.negate(erfinv(0.5)), KERNEL_TOLERANCE)
    }))

  it.effect("erfinv(0.99) ≈ 1.8214", () =>
    Effect.gen(function*() {
      expectClose(erfinv(0.99), 1.8213863677184496, KERNEL_TOLERANCE)
    }))
})

describe("Special / erfcinv", () => {
  it.effect("erfcinv(1) ≈ 0", () =>
    Effect.gen(function*() {
      expectClose(erfcinv(1), 0, KERNEL_TOLERANCE)
    }))

  it.effect("erfcinv(0.5) ≈ erfinv(0.5)", () =>
    Effect.gen(function*() {
      expectClose(erfcinv(0.5), erfinv(0.5), KERNEL_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — gammainc / gammaincc
// ---------------------------------------------------------------------------

describe("Special / gammainc", () => {
  it.effect("gammainc(1, 1) ≈ 1 - exp(-1)", () =>
    Effect.gen(function*() {
      expectClose(gammainc(1, 1), N.subtract(1, Math.exp(-1)), KERNEL_TOLERANCE)
    }))

  it.effect("gammainc(0.5, 1) ≈ 0.8427", () =>
    Effect.gen(function*() {
      expectClose(gammainc(0.5, 1), 0.8427007929497151, KERNEL_TOLERANCE)
    }))

  it.effect("gammainc(1, 10) ≈ 0.99995", () =>
    Effect.gen(function*() {
      expectClose(gammainc(1, 10), 0.9999546000702375, KERNEL_TOLERANCE)
    }))
})

describe("Special / gammaincc", () => {
  it.effect("gammaincc(1, 1) ≈ exp(-1)", () =>
    Effect.gen(function*() {
      expectClose(gammaincc(1, 1), Math.exp(-1), KERNEL_TOLERANCE)
    }))

  it.effect("gammainc(a, x) + gammaincc(a, x) ≈ 1", () =>
    Effect.gen(function*() {
      expectClose(N.sum(gammainc(5, 5), gammaincc(5, 5)), 1, KERNEL_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — betainc
// ---------------------------------------------------------------------------

describe("Special / betainc", () => {
  it.effect("betainc(a, b, 0) = 0", () =>
    Effect.gen(function*() {
      expectClose(betainc(2, 3, 0), 0, KERNEL_TOLERANCE)
    }))

  it.effect("betainc(a, b, 1) = 1", () =>
    Effect.gen(function*() {
      expectClose(betainc(2, 3, 1), 1, KERNEL_TOLERANCE)
    }))

  it.effect("betainc(1, 1, 0.5) = 0.5", () =>
    Effect.gen(function*() {
      expectClose(betainc(1, 1, 0.5), 0.5, KERNEL_TOLERANCE)
    }))

  it.effect("betainc(2, 3, 0.5) ≈ 0.6875", () =>
    Effect.gen(function*() {
      expectClose(betainc(2, 3, 0.5), 0.6875, KERNEL_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — polygamma
// ---------------------------------------------------------------------------

describe("Special / polygamma", () => {
  it.effect("polygamma(0, 1) ≈ -γ (Euler–Mascheroni)", () =>
    Effect.gen(function*() {
      expectClose(polygamma(0, 1), -0.5772156649015329, POLYGAMMA_TOLERANCE)
    }))

  it.effect("polygamma(1, 1) ≈ π²/6", () =>
    Effect.gen(function*() {
      expectClose(polygamma(1, 1), 1.6449340668482266, POLYGAMMA_TOLERANCE)
    }))

  it.effect("polygamma(2, 1) ≈ -2.404", () =>
    Effect.gen(function*() {
      expectClose(polygamma(2, 1), -2.404113806319188, POLYGAMMA_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Special / erfinvValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* erfinvValidated({ x: 0.5 })
      expectClose(result, 0.4769362762044699, KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(erfinvValidated({ x: 0.5, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Special / gammaincValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* gammaincValidated({ a: 1, x: 1 })
      expectClose(result, N.subtract(1, Math.exp(-1)), KERNEL_TOLERANCE)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(gammaincValidated({ a: 1, x: 1, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Special / betaincValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* betaincValidated({ a: 2, b: 3, x: 0 })
      expectClose(result, 0, KERNEL_TOLERANCE)
    }))
})

describe("Special / polygammaValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* polygammaValidated({ n: 0, x: 1 })
      expectClose(result, -0.5772156649015329, POLYGAMMA_TOLERANCE)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Special / erfinvWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const result = yield* erfinvWithPolicies(0.5)
      expectClose(result, 0.4769362762044699, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* erfinvWithPolicies(0.5)
      expectClose(result, 0.4769362762044699, KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Special / gammaincWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const result = yield* gammaincWithPolicies(1, 1)
      expectClose(result, N.subtract(1, Math.exp(-1)), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* gammaincWithPolicies(1, 1)
      expectClose(result, N.subtract(1, Math.exp(-1)), KERNEL_TOLERANCE)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
