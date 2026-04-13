import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as N } from "effect"

import { cos, exp } from "../../src/Numeric/operations.js"
import { findRoot } from "../../src/Optimization/operations.js"

const cases = Arr.make(
  {
    name: "Brent on x^2 - 2",
    result: () =>
      findRoot((x) => N.subtract(N.multiply(x, x), 2), {
        method: "brent",
        lowerBound: 0,
        upperBound: 2
      }),
    maxIterations: 40,
    maxFunctionEvaluations: 60,
    maxResidual: 1e-8
  },
  {
    name: "Brent on cos(x) - x^3",
    result: () =>
      findRoot(
        (x) => N.subtract(cos(x), N.multiply(N.multiply(x, x), x)),
        {
          method: "brent",
          lowerBound: 0,
          upperBound: 1,
          maxIterations: 12
        }
      ),
    maxIterations: 12,
    maxFunctionEvaluations: 16,
    maxResidual: 1e-10
  },
  {
    name: "Brent on a tightly converged near-zero bracket",
    result: () =>
      findRoot(
        (x) => N.multiply(1e-200, N.subtract(x, 1e-20)),
        {
          method: "brent",
          lowerBound: 0,
          upperBound: 1e-10,
          absoluteTolerance: 1e-300,
          relativeTolerance: 0,
          maxIterations: 16
        }
      ),
    maxIterations: 16,
    maxFunctionEvaluations: 20,
    maxResidual: 1e-220
  },
  {
    name: "secant on cos(x)",
    result: () =>
      findRoot(cos, {
        method: "secant",
        previousEstimate: 1,
        currentEstimate: 2
      }),
    maxIterations: 20,
    maxFunctionEvaluations: 30,
    maxResidual: 1e-8
  },
  {
    name: "Newton-Raphson on exp(x) - 2",
    result: () =>
      findRoot(
        (x) => N.subtract(exp(x), 2),
        {
          method: "newtonRaphson",
          initialGuess: 0.5
        },
        {
          derivative: exp
        }
      ),
    maxIterations: 10,
    maxFunctionEvaluations: 12,
    maxResidual: 1e-10
  }
)

describe("Optimization / root-finding convergence", () => {
  it.effect("keeps Brent, secant, and Newton-Raphson within their declared budgets", () =>
    Effect.forEach(
      cases,
      (rootCase) =>
        Effect.sync(() => {
          const result = rootCase.result()

          expect(result.status).toBe("converged")
          expect(result.iterationCount).toBeLessThanOrEqual(rootCase.maxIterations)
          expect(result.functionEvaluationCount).toBeLessThanOrEqual(rootCase.maxFunctionEvaluations)
          expect(result.residual).toBeLessThanOrEqual(rootCase.maxResidual)
        }),
      { discard: true }
    ))

  it.effect("keeps Brent interpolation active for tightly converged near-zero ordinates", () =>
    Effect.sync(() => {
      const result = findRoot(
        (x) => N.multiply(1e-200, N.subtract(x, 1e-20)),
        {
          method: "brent",
          lowerBound: 0,
          upperBound: 1e-10,
          absoluteTolerance: 1e-300,
          relativeTolerance: 0,
          maxIterations: 16
        }
      )

      expect(result.status).toBe("converged")
      expect(result.root).toBeCloseTo(1e-20, 30)
      expect(result.functionEvaluationCount).toBeLessThanOrEqual(4)
    }))

  it.effect("returns immediately when Brent starts on an exact bracket endpoint root", () =>
    Effect.sync(() => {
      const result = findRoot(
        (x) => N.subtract(x, 1),
        {
          method: "brent",
          lowerBound: 0,
          upperBound: 1,
          maxIterations: 20_000
        }
      )

      expect(result.status).toBe("converged")
      expect(result.root).toBe(1)
      expect(result.iterationCount).toBe(0)
      expect(result.functionEvaluationCount).toBe(2)
    }))

  it.effect("stays stack-safe for large non-convergent iteration budgets", () =>
    Effect.sync(() => {
      const maxIterations = 20_000
      const result = findRoot(
        () => 1,
        {
          method: "newtonRaphson",
          initialGuess: 0,
          absoluteTolerance: 0,
          relativeTolerance: 0,
          maxIterations
        },
        {
          derivative: () => 1
        }
      )

      expect(result.status).toBe("maxIterationsExceeded")
      expect(result.iterationCount).toBe(maxIterations)
      expect(result.functionEvaluationCount).toBe(maxIterations + 1)
      expect(result.residual).toBe(1)
    }))
})
