import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Effect, Exit, FastCheck, MutableRef, Number, Schema, String } from "effect"

import {
  derivative,
  derivativeLimit,
  derivativeLimitValidated,
  derivativeLimitWithPolicies,
  secondDerivative,
  secondDerivativeLimit,
  secondDerivativeLimitValidated,
  secondDerivativeLimitWithPolicies
} from "../../src/Calculus.js"
import * as Numeric from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"

const strictPolicies = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedPolicies = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Calculus / univariate limit operators", () => {
  it.effect("derivativeLimit returns converged estimate with bounded error", () =>
    Effect.gen(function*() {
      const estimate = derivativeLimit(Numeric.sin, Number.unsafeDivide(Numeric.pi, 3))

      expect(estimate.converged).toStrictEqual(true)
      expect(estimate.iterations).toBeGreaterThanOrEqual(1)
      expectClose(estimate.value, 0.5, 1e-10)
      expect(estimate.absoluteError).toBeLessThanOrEqual(1e-8)
    }))

  it.effect.prop("reports the actual refinement count without exceeding the callback budget", {
    budget: FastCheck.integer({ min: 1, max: 16 })
  }, ({ budget }) =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const estimate = derivativeLimit(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.sum(Number.multiply(3, x), 1)
        },
        2,
        {
          initialStep: Numeric.StepSize.make(0.125),
          contractionFactor: 2,
          maxIterations: Numeric.IterationBudget.make(budget)
        }
      )
      // A linear function on these exact dyadic steps needs two identical
      // central differences to certify convergence; a budget of one cannot.
      const iterations = Number.min(budget, 2)
      expect(estimate.value).toBe(3)
      expect(estimate.iterations).toBe(iterations)
      expect(estimate.converged).toBe(Number.greaterThan(budget, 1))
      expect(estimate.absoluteError).toBe(Boolean.match(Number.Equivalence(budget, 1), {
        onTrue: () => Number.unsafeDivide(1, 0),
        onFalse: () => 0
      }))
      expect(MutableRef.get(evaluations)).toBe(Number.multiply(iterations, 2))
    }))

  it.effect("uses the caller's larger refinement budget when the derivative does not converge", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const estimate = derivativeLimit(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.multiply(Number.sign(x), Numeric.sqrt(Numeric.abs(x)))
        },
        0,
        {
          initialStep: Numeric.StepSize.make(1),
          contractionFactor: 2,
          maxIterations: Numeric.IterationBudget.make(16),
          absoluteTolerance: Numeric.AbsoluteTolerance.make(1e-100),
          relativeTolerance: Numeric.RelativeTolerance.make(1e-100),
          safetyFactor: 1e100
        }
      )
      // The derivative at zero is unbounded; with the runaway threshold
      // suppressed, all sixteen two-sided samples must be evaluated.
      expect(estimate.converged).toBe(false)
      expect(MutableRef.get(evaluations)).toBe(32)
    }))

  it.effect("does not report convergence when extrapolation overflows a finite derivative", () =>
    Effect.gen(function*() {
      const estimate = derivativeLimit((x) => Number.multiply(x, 1e308), 0, {
        initialStep: Numeric.StepSize.make(0.125),
        contractionFactor: 2,
        maxIterations: Numeric.IterationBudget.make(4)
      })
      // The central differences are finite; multiplying them by the
      // extrapolation factor overflows. Keep the finite initial estimate
      // without treating a NaN error bound as a convergence certificate.
      expect(estimate.value).toBe(1e308)
      expect(estimate.absoluteError).toBe(Number.unsafeDivide(1, 0))
      expect(estimate.converged).toBe(false)
    }))

  it.effect("secondDerivativeLimit converges for exp(x) at x=1", () =>
    Effect.gen(function*() {
      const estimate = secondDerivativeLimit(Numeric.exp, 1)

      expect(estimate.converged).toStrictEqual(true)
      expectClose(estimate.value, Numeric.exp(1), 1e-9)
      expect(estimate.absoluteError).toBeLessThanOrEqual(1e-7)
    }))

  it.effect("derivative forwards to the limit-accurate solver", () =>
    Effect.gen(function*() {
      expectClose(derivative(Numeric.exp, 0), 1, 1e-10)
      expectClose(derivative(Numeric.abs, 0), 0, 1e-10)
    }))

  it.effect("secondDerivative forwards to the limit-accurate solver", () =>
    Effect.gen(function*() {
      const cubic = (x: number) => Number.multiply(Number.multiply(x, x), x)
      expectClose(secondDerivative(cubic, 2), 12, 1e-7)
    }))
})

describe("Calculus / univariate validation", () => {
  it.effect("derivativeLimitValidated decodes strict input", () =>
    Effect.gen(function*() {
      const estimate = yield* derivativeLimitValidated(Numeric.sin, {
        x: Number.unsafeDivide(Numeric.pi, 3),
        initialStep: 1e-3,
        maxIterations: 10
      })

      expect(estimate.converged).toStrictEqual(true)
      expectClose(estimate.value, 0.5, 1e-10)
    }))

  it.effect("rejects nonpositive, fractional, nonfinite, and unsafe iteration budgets at the boundary", () =>
    Effect.forEach(
      Array.make(0, -1, 1.5, Number.unsafeDivide(1, 0), Number.unsafeDivide(0, 0), 9_007_199_254_740_992),
      (maxIterations) =>
        Effect.gen(function*() {
          const result = yield* Effect.exit(derivativeLimitValidated(Numeric.sin, { x: 1, maxIterations }))
          expect(Exit.isFailure(result)).toBe(true)
        })
    ))

  it.effect("secondDerivativeLimitValidated rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(secondDerivativeLimitValidated(Numeric.sin, {
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
      expect(String.isNonEmpty(error.message)).toStrictEqual(true)
    }))
})

describe("Calculus / univariate policy behavior", () => {
  it.effect("strict precision rejects non-finite derivative limits", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(derivativeLimitWithPolicies(() => Number.unsafeDivide(1, 0), 1))
      expect(Exit.isFailure(result)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("relaxed precision permits non-finite derivative limits", () =>
    Effect.gen(function*() {
      const estimate = yield* derivativeLimitWithPolicies(() => Number.unsafeDivide(1, 0), 1)

      expect(Numeric.isFinite(estimate.value)).toStrictEqual(false)
      expect(estimate.converged).toStrictEqual(false)
    }).pipe(Effect.provide(relaxedPolicies)))

  it.effect("strict precision keeps converged second derivative estimates", () =>
    Effect.gen(function*() {
      const point = Number.unsafeDivide(Numeric.pi, 3)
      const estimate = yield* secondDerivativeLimitWithPolicies(Numeric.sin, point)

      expect(estimate.converged).toStrictEqual(true)
      expectClose(estimate.value, Number.negate(Numeric.sin(point)), 1e-9)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("policy wrappers map callback throws to typed kernel errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(derivativeLimitWithPolicies(
        () => Schema.decodeUnknownSync(Schema.Number)({ invalid: true }),
        1
      ))

      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("derivativeLimitWithPolicies")
      expect(String.isNonEmpty(error.message)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))
})
