import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"
import { makeComputationDispatcherLayer } from "./shared/computation-dispatch-layer.js"

describe("advanced computation dispatcher seam contracts", () => {
  it.effect("honors externally provided runtime backend policy", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeComputationDispatcherLayer({ backendPolicy: "typed-array" })))

      expect(plan.backendKind).toStrictEqual("typed-array")
      expect(plan.differentiationMethod).toStrictEqual("none")
    }))
})
