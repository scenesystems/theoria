import { describe, expect, it } from "@effect/vitest"
import { Effect, Number } from "effect"

import { abs, exp } from "../../src/Numeric.js"
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
})

// ---------------------------------------------------------------------------
// Pure kernel operations — gammainc / gammaincc
// ---------------------------------------------------------------------------

describe("Special / gammainc", () => {
  it.effect("gammainc(1, 1) ≈ 1 - exp(-1)", () =>
    Effect.gen(function*() {
      expectClose(gammainc(1, 1), Number.subtract(1, exp(-1)), kernelTolerance)
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
