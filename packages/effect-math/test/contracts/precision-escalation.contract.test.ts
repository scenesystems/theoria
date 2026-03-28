import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ComputationDispatchLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"

describe("advanced precision escalation contracts", () => {
  it.effect("escalates from float64 to bigdecimal when convergence fails", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "calculus",
        operationName: "gradient",
        requestedScalarKind: "float64",
        preferredAutodiff: "forward",
        escalationAttempt: 1,
        converged: false,
        requiresAutodiff: true,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.escalated).toStrictEqual(true)
      expect(plan.scalarKind).toStrictEqual("bigdecimal")
    }))
})
