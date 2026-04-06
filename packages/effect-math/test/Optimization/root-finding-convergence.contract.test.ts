import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as N } from "effect"

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
    name: "secant on cos(x)",
    result: () =>
      findRoot(Math.cos, {
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
        (x) => N.subtract(Math.exp(x), 2),
        {
          method: "newtonRaphson",
          initialGuess: 0.5
        },
        {
          derivative: Math.exp
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
})
