import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ComputationDispatchLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"
import { type PrecisionEscalationPolicyType } from "../../src/contracts/shared/PrecisionEscalation.js"
import { makeComputationDispatcherLayer } from "./shared/computation-dispatch-layer.js"

const convergedObservation = {
  absoluteError: 1e-12,
  relativeError: 1e-10,
  iterations: 4
}

const divergentObservation = {
  absoluteError: 1e-4,
  relativeError: 1e-3,
  iterations: 64
}

const precisionPrimaryBigdecimalPolicy: PrecisionEscalationPolicyType = {
  primaryKind: "bigdecimal",
  escalationOrder: ["bigdecimal", "float64"],
  maxEscalations: 2,
  convergenceGate: {
    absoluteTolerance: 1e-10,
    relativeTolerance: 1e-8,
    maxIterations: 16
  }
}

const precisionPrimaryBigdecimalLayer = makeComputationDispatcherLayer({
  precisionEscalation: precisionPrimaryBigdecimalPolicy
})

describe("advanced precision escalation contracts", () => {
  it.effect("keeps scalar lane when convergence observations satisfy the convergence gate", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        convergence: convergedObservation,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.convergenceSatisfied).toStrictEqual(true)
      expect(plan.escalated).toStrictEqual(false)
      expect(plan.precisionEscalationSource).toStrictEqual("none")
    }))

  it.effect("uses escalationOrder when convergence observations violate the convergence gate", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        convergence: divergentObservation,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.convergenceSatisfied).toStrictEqual(false)
      expect(plan.escalated).toStrictEqual(true)
      expect(plan.scalarKind).toStrictEqual("bigdecimal")
      expect(plan.precisionEscalationSource).toStrictEqual("escalation-order")
    }))

  it.effect("promotes to precision primaryKind on first failed convergence for policy-driven lanes", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        escalationAttempt: 0,
        convergence: divergentObservation,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(precisionPrimaryBigdecimalLayer))

      expect(plan.scalarResolutionSource).toStrictEqual("policy-primary")
      expect(plan.scalarKind).toStrictEqual("bigdecimal")
      expect(plan.precisionEscalationSource).toStrictEqual("primary-kind")
      expect(plan.escalated).toStrictEqual(true)
    }))
})
