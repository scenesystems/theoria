import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Number as N } from "effect"

import { BackendPolicyService, DiagnosticsPolicyService, PrecisionPolicyService } from "../../src/contracts/index.js"
import { findRootWithPolicies } from "../../src/Optimization/index.js"

const strictBackendLayer = (backend: "scalar" | "typed-array") =>
  Layer.mergeAll(
    Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
    Layer.succeed(BackendPolicyService, { policy: backend }),
    Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
  )

describe("Optimization / root-finding runtime boundary contracts", () => {
  it.effect("keeps policy-aware root finding on shared dispatch while honoring backend policy", () =>
    Effect.gen(function*() {
      const objective = (x: number) => N.subtract(N.multiply(x, x), 2)

      const scalarBrent = yield* findRootWithPolicies(objective, {
        method: "brent",
        lowerBound: 0,
        upperBound: 2
      }).pipe(Effect.provide(strictBackendLayer("scalar")))
      const typedBrent = yield* findRootWithPolicies(objective, {
        method: "brent",
        lowerBound: 0,
        upperBound: 2
      }).pipe(Effect.provide(strictBackendLayer("typed-array")))
      const typedNewton = yield* findRootWithPolicies(objective, {
        method: "newtonRaphson",
        initialGuess: 1.5
      }).pipe(Effect.provide(strictBackendLayer("typed-array")))

      expect(typedBrent.method).toBe("brent")
      expect(typedNewton.method).toBe("newtonRaphson")
      expect(typedBrent.status).toBe("converged")
      expect(typedNewton.status).toBe("converged")
      expect(typedBrent.root).toBeCloseTo(scalarBrent.root, 12)
      expect(typedNewton.root).toBeCloseTo(Math.sqrt(2), 10)
    }))
})
