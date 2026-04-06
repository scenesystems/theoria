import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Number as N } from "effect"

import { AutodiffAuthorityService, DefaultAutodiffAuthority } from "../../src/contracts/shared/AutodiffAuthority.js"
import { findRootValidated } from "../../src/Optimization/operations.js"

const defaultDerivativeAuthorityLayer = Layer.succeed(AutodiffAuthorityService, DefaultAutodiffAuthority)

const missingDerivativeAuthorityLayer = Layer.succeed(AutodiffAuthorityService, {
  policy: {
    preferredOrder: ["reverse"],
    allowFiniteDifferenceFallback: false
  },
  capabilities: [{
    mode: "reverse",
    available: false
  }]
})

describe("Optimization / root finding boundary", () => {
  it.effect("rejects invalid Brent bracket ordering with a typed optimization failure", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(findRootValidated((x) => N.subtract(N.multiply(x, x), 2), {
        method: "brent",
        lowerBound: 2,
        upperBound: 0
      }))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("OptimizationParameterError")
      }
    }).pipe(Effect.provide(defaultDerivativeAuthorityLayer)))

  it.effect("rejects Newton-Raphson zero-derivative states with a typed optimization failure", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        findRootValidated(
          (x) => N.subtract(N.multiply(N.multiply(x, x), x), 1),
          {
            method: "newtonRaphson",
            initialGuess: 0
          },
          {
            derivative: (x) => N.multiply(3, N.multiply(x, x))
          }
        )
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("OptimizationDerivativeAuthorityError")
      }
    }).pipe(Effect.provide(defaultDerivativeAuthorityLayer)))

  it.effect("uses the shared autodiff authority when Newton-Raphson omits an explicit derivative", () =>
    Effect.gen(function*() {
      const result = yield* findRootValidated(
        (x) => N.subtract(N.multiply(x, x), 2),
        {
          method: "newtonRaphson",
          initialGuess: 1.5
        }
      )

      expect(result.method).toBe("newtonRaphson")
      expect(result.status).toBe("converged")
      expect(Math.abs(N.subtract(result.root, Math.sqrt(2)))).toBeLessThanOrEqual(1e-8)
    }).pipe(Effect.provide(defaultDerivativeAuthorityLayer)))

  it.effect("rejects Newton-Raphson requests that have no derivative authority", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        findRootValidated(
          (x) => N.subtract(N.multiply(x, x), 2),
          {
            method: "newtonRaphson",
            initialGuess: 1.5
          }
        ).pipe(Effect.provide(missingDerivativeAuthorityLayer))
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("OptimizationDerivativeAuthorityError")
      }
    }))

  it.effect("rejects exhausted iteration budgets with a typed convergence failure", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(findRootValidated((x) => N.subtract(N.multiply(x, x), 2), {
        method: "secant",
        previousEstimate: 1,
        currentEstimate: 2,
        maxIterations: 1
      }))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("OptimizationConvergenceError")
      }
    }).pipe(Effect.provide(defaultDerivativeAuthorityLayer)))
})
