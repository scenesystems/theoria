import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ComputationDispatchLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"

describe("advanced scalar authority contracts", () => {
  it.effect("dispatches bigdecimal lane with same plan shape as float64 lane", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        requestedScalarKind: "bigdecimal",
        escalationAttempt: 0,
        converged: true,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.scalarKind).toStrictEqual("bigdecimal")
      expect(typeof plan.backendKind).toStrictEqual("string")
    }))
})
