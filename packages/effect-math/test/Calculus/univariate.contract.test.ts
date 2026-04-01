import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Number as N, Schema } from "effect"

import {
  derivative,
  derivativeLimit,
  derivativeLimitValidated,
  derivativeLimitWithPolicies,
  secondDerivative,
  secondDerivativeLimit,
  secondDerivativeLimitValidated,
  secondDerivativeLimitWithPolicies
} from "../../src/Calculus/operations.js"
import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"

const strictPolicies = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const relaxedPolicies = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Calculus / univariate limit operators", () => {
  it.effect("derivativeLimit returns converged estimate with bounded error", () =>
    Effect.gen(function*() {
      const estimate = derivativeLimit(Math.sin, Math.PI / 3)

      expect(estimate.converged).toStrictEqual(true)
      expect(estimate.iterations).toBeGreaterThanOrEqual(1)
      expectClose(estimate.value, 0.5, 1e-10)
      expect(estimate.absoluteError).toBeLessThanOrEqual(1e-8)
    }))

  it.effect("secondDerivativeLimit converges for exp(x) at x=1", () =>
    Effect.gen(function*() {
      const estimate = secondDerivativeLimit(Math.exp, 1)

      expect(estimate.converged).toStrictEqual(true)
      expectClose(estimate.value, Math.exp(1), 1e-9)
      expect(estimate.absoluteError).toBeLessThanOrEqual(1e-7)
    }))

  it.effect("derivative forwards to the limit-accurate solver", () =>
    Effect.gen(function*() {
      expectClose(derivative(Math.exp, 0), 1, 1e-10)
      expectClose(derivative(Math.abs, 0), 0, 1e-10)
    }))

  it.effect("secondDerivative forwards to the limit-accurate solver", () =>
    Effect.gen(function*() {
      const cubic = (x: number) => N.multiply(N.multiply(x, x), x)
      expectClose(secondDerivative(cubic, 2), 12, 1e-7)
    }))

  it.effect("rejects legacy numeric third-arg Ridder config in pure paths", () =>
    Effect.gen(function*() {
      expect(() => Reflect.apply(derivativeLimit, undefined, [Math.sin, 0, 1])).toThrow()
    }))
})

describe("Calculus / univariate validated boundaries", () => {
  it.effect("derivativeLimitValidated decodes strict input", () =>
    Effect.gen(function*() {
      const estimate = yield* derivativeLimitValidated(Math.sin, {
        x: Math.PI / 3,
        initialStep: 1e-3,
        maxIterations: 10
      })

      expect(estimate.converged).toStrictEqual(true)
      expectClose(estimate.value, 0.5, 1e-10)
    }))

  it.effect("secondDerivativeLimitValidated rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(secondDerivativeLimitValidated(Math.sin, {
        x: 1,
        maxIterations: 6,
        extra: true
      }))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }))

  it.effect("derivativeLimitValidated maps callback throws to typed kernel errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(derivativeLimitValidated(
        () => Schema.decodeUnknownSync(Schema.Number)({ invalid: true }),
        { x: 1 }
      ))

      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("derivativeLimit")
      expect(error.message.length > 0).toStrictEqual(true)
    }))
})

describe("Calculus / univariate policy behavior", () => {
  it.effect("strict precision rejects non-finite derivative limits", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(derivativeLimitWithPolicies(() => Number.POSITIVE_INFINITY, 1))
      expect(Exit.isFailure(result)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("relaxed precision permits non-finite derivative limits", () =>
    Effect.gen(function*() {
      const estimate = yield* derivativeLimitWithPolicies(() => Number.POSITIVE_INFINITY, 1)

      expect(Number.isFinite(estimate.value)).toStrictEqual(false)
      expect(estimate.converged).toStrictEqual(false)
    }).pipe(Effect.provide(relaxedPolicies)))

  it.effect("strict precision keeps converged second derivative estimates", () =>
    Effect.gen(function*() {
      const estimate = yield* secondDerivativeLimitWithPolicies(Math.sin, Math.PI / 3)

      expect(estimate.converged).toStrictEqual(true)
      expectClose(estimate.value, -Math.sin(Math.PI / 3), 1e-9)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("policy wrappers map callback throws to typed kernel errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(derivativeLimitWithPolicies(
        () => Schema.decodeUnknownSync(Schema.Number)({ invalid: true }),
        1
      ))

      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("derivativeLimitWithPolicies")
      expect(error.message.length > 0).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))
})
