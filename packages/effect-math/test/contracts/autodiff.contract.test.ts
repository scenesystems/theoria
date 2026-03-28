import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ComputationDispatchLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"

describe("advanced autodiff authority contracts", () => {
  it.effect("routes calculus gradients to reverse mode autodiff when requested", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "calculus",
        operationName: "gradient",
        requestedScalarKind: "float64",
        preferredAutodiff: "reverse",
        escalationAttempt: 0,
        converged: true,
        requiresAutodiff: true,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.autodiffMode).toStrictEqual("reverse")
    }))
})
