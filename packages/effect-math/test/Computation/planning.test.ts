import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Option, Schema } from "effect"

import * as Autodiff from "../../src/Autodiff.js"
import * as Computation from "../../src/Computation.js"
import * as Precision from "../../src/Precision.js"
import { layer } from "./layer.js"

const divergent = {
  absoluteError: 1e-4,
  relativeError: 1e-3,
  iterations: 64
}

const unavailableAutodiff = Schema.decodeUnknownSync(Autodiff.Settings)({
  policy: {
    preferredOrder: Array.make("reverse", "forward"),
    allowFiniteDifferenceFallback: true
  },
  capabilities: Array.make(
    { mode: "reverse", available: false },
    { mode: "forward", available: false }
  )
})

const primaryBigDecimal = Schema.decodeUnknownSync(Precision.Policy)({
  primaryKind: "bigdecimal",
  escalationOrder: Array.make("bigdecimal", "float64"),
  maxEscalations: 2,
  convergenceGate: {
    absoluteTolerance: 1e-10,
    relativeTolerance: 1e-8,
    maxIterations: 16
  }
})

describe("Computation.plan", () => {
  it.effect("plans escalation, backend fallback, and uncertainty without executing a kernel", () =>
    Effect.gen(function*() {
      const plan = yield* Computation.plan({
        operationCategory: "calculus",
        operationName: "adaptiveSimpson",
        requestedScalarKind: "float64",
        preferredBackend: "accelerated",
        escalationAttempt: 0,
        convergence: divergent,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: true
      }).pipe(Effect.provide(layer({ backend: "compensated" })))

      expect(plan.scalarKind).toStrictEqual("bigdecimal")
      expect(plan.precisionEscalationSource).toStrictEqual("escalation-order")
      expect(plan.backendKind).toStrictEqual("scalar")
      expect(plan.uncertaintyEnvelope).toStrictEqual(true)
      expect(plan.differentiationMethod).toStrictEqual("none")
    }))

  it.effect("uses finite-difference fallback only when autodiff is required", () =>
    Effect.gen(function*() {
      const plan = yield* Computation.plan({
        operationCategory: "calculus",
        operationName: "gradient",
        escalationAttempt: 0,
        requiresAutodiff: true,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(layer({ autodiff: unavailableAutodiff })))

      expect(plan.differentiationMethod).toStrictEqual("finite-difference")
      expect(plan.autodiffMode).toStrictEqual(Option.none())
      expect(plan.finiteDifferenceFallback).toStrictEqual(true)
    }))

  it.effect("promotes a policy-selected fallback to precision primary on first failure", () =>
    Effect.gen(function*() {
      const plan = yield* Computation.plan({
        operationCategory: "numeric",
        operationName: "sum",
        escalationAttempt: 0,
        convergence: divergent,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(layer({ precision: primaryBigDecimal })))

      expect(plan.scalarResolutionSource).toStrictEqual("policy-primary")
      expect(plan.scalarKind).toStrictEqual("bigdecimal")
      expect(plan.precisionEscalationSource).toStrictEqual("primary-kind")
    }))

  it.effect("rejects malformed and excess request data in the decode error channel", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        Computation.plan({
          operationCategory: "numeric",
          operationName: "sum",
          escalationAttempt: 0,
          requiresAutodiff: false,
          requiresUncertaintyEnvelope: false,
          execute: true
        }).pipe(Effect.provide(Computation.layer))
      )

      expect(error._tag).toStrictEqual("ComputationDispatchDecodeError")
      expect(error.operation).toStrictEqual("ComputationDispatchRequest")
    }))
})
