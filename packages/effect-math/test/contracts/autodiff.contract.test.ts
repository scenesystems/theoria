import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { type AutodiffAuthorityStateType } from "../../src/contracts/shared/AutodiffAuthority.js"
import { ComputationDispatchLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"
import { makeComputationDispatcherLayer } from "./shared/computation-dispatch-layer.js"

const makeUnavailableAutodiffAuthority = (
  allowFiniteDifferenceFallback: boolean
): AutodiffAuthorityStateType => ({
  policy: {
    preferredOrder: ["reverse", "forward"],
    allowFiniteDifferenceFallback
  },
  capabilities: [{
    mode: "reverse",
    available: false
  }, {
    mode: "forward",
    available: false
  }]
})

const makeDispatcherLayer = (allowFiniteDifferenceFallback: boolean) =>
  makeComputationDispatcherLayer({
    autodiffAuthority: makeUnavailableAutodiffAuthority(allowFiniteDifferenceFallback)
  })

describe("advanced autodiff authority contracts", () => {
  it.effect("routes calculus gradients to reverse mode autodiff when requested", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "calculus",
        operationName: "gradient",
        requestedScalarKind: "float64",
        preferredAutodiff: "reverse",
        escalationAttempt: 0,
        requiresAutodiff: true,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.differentiationMethod).toStrictEqual("autodiff")
      expect(plan.autodiffMode).toStrictEqual("reverse")
      expect(plan.finiteDifferenceFallback).toStrictEqual(false)
    }))

  it.effect("falls back to finite-difference when autodiff is unavailable and fallback is allowed", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "calculus",
        operationName: "gradient",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        requiresAutodiff: true,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeDispatcherLayer(true)))

      expect(plan.differentiationMethod).toStrictEqual("finite-difference")
      expect(plan.autodiffMode).toStrictEqual(undefined)
      expect(plan.finiteDifferenceFallback).toStrictEqual(true)
    }))

  it.effect("fails with AutodiffUnavailableError when fallback is disabled", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        planAdvancedComputation({
          operationCategory: "calculus",
          operationName: "gradient",
          requestedScalarKind: "float64",
          escalationAttempt: 0,
          requiresAutodiff: true,
          requiresUncertaintyEnvelope: false
        }).pipe(Effect.provide(makeDispatcherLayer(false)))
      )

      expect(error._tag).toStrictEqual("AutodiffUnavailableError")
    }))
})
