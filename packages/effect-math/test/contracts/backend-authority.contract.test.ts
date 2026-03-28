import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ComputationDispatchLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"

describe("advanced backend authority contracts", () => {
  it.effect("falls back deterministically from accelerated to typed-array backend", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "linear-algebra",
        operationName: "dot",
        requestedScalarKind: "float64",
        preferredBackend: "accelerated",
        escalationAttempt: 0,
        converged: true,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.backendKind).toStrictEqual("typed-array")
    }))

  it.effect("locks no-preference selection to canonical scalar-first backend", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "linear-algebra",
        operationName: "dot",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        converged: true,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.backendKind).toStrictEqual("scalar")
    }))
})
