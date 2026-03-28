import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"
import { makeComputationDispatcherLayer } from "./shared/computation-dispatch-layer.js"

const makeDispatcherLayer = (policy: "typed-array" | "scalar") =>
  makeComputationDispatcherLayer({ backendPolicy: policy })

describe("advanced backend authority contracts", () => {
  it.effect("keeps backend selection on runtime policy authority when accelerated is requested", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "linear-algebra",
        operationName: "dot",
        requestedScalarKind: "float64",
        preferredBackend: "accelerated",
        escalationAttempt: 0,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeDispatcherLayer("typed-array")))

      expect(plan.backendKind).toStrictEqual("typed-array")
    }))

  it.effect("locks no-preference selection to scalar backend when runtime policy is scalar", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "linear-algebra",
        operationName: "dot",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeDispatcherLayer("scalar")))

      expect(plan.backendKind).toStrictEqual("scalar")
    }))

  it.effect("falls back to scalar when typed-array policy cannot satisfy bigdecimal lane", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "linear-algebra",
        operationName: "dot",
        requestedScalarKind: "bigdecimal",
        escalationAttempt: 0,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeDispatcherLayer("typed-array")))

      expect(plan.backendKind).toStrictEqual("scalar")
    }))
})
