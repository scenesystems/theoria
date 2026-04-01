import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"
import { type ScalarAuthorityStateType } from "../../src/contracts/shared/ScalarAuthority.js"
import { makeComputationDispatcherLayer } from "./shared/computation-dispatch-layer.js"

const makeDispatcherLayer = (scalarAuthority: ScalarAuthorityStateType) =>
  makeComputationDispatcherLayer({ scalarAuthority })

const primaryBigdecimalAuthority: ScalarAuthorityStateType = {
  policy: {
    primaryKind: "bigdecimal",
    fallbackOrder: ["bigdecimal", "float64"]
  },
  capabilities: [{
    kind: "float64",
    supportedCategories: ["numeric", "linear-algebra", "calculus", "optimization"],
    deterministic: true,
    supportsExactArithmetic: false
  }, {
    kind: "bigdecimal",
    supportedCategories: ["numeric", "linear-algebra", "calculus", "optimization"],
    deterministic: true,
    supportsExactArithmetic: true
  }]
}

const primaryUnsupportedForCalculusAuthority: ScalarAuthorityStateType = {
  policy: {
    primaryKind: "bigdecimal",
    fallbackOrder: ["bigdecimal", "float64"]
  },
  capabilities: [{
    kind: "float64",
    supportedCategories: ["numeric", "linear-algebra", "calculus", "optimization"],
    deterministic: true,
    supportsExactArithmetic: false
  }, {
    kind: "bigdecimal",
    supportedCategories: ["numeric"],
    deterministic: true,
    supportsExactArithmetic: true
  }]
}

describe("advanced scalar authority contracts", () => {
  it.effect("uses scalar primaryKind when no scalar request is provided", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        escalationAttempt: 0,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeDispatcherLayer(primaryBigdecimalAuthority)))

      expect(plan.scalarKind).toStrictEqual("bigdecimal")
      expect(plan.scalarResolutionSource).toStrictEqual("policy-primary")
      expect(plan.backendKind).toStrictEqual("scalar")
    }))

  it.effect("uses fallbackOrder when primaryKind cannot serve the operation category", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "calculus",
        operationName: "gradient",
        escalationAttempt: 0,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeDispatcherLayer(primaryUnsupportedForCalculusAuthority)))

      expect(plan.scalarKind).toStrictEqual("float64")
      expect(plan.scalarResolutionSource).toStrictEqual("policy-fallback")
    }))

  it.effect("honors explicit scalar requests before policy order", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(makeDispatcherLayer(primaryBigdecimalAuthority)))

      expect(plan.scalarKind).toStrictEqual("float64")
      expect(plan.scalarResolutionSource).toStrictEqual("requested")
    }))
})
