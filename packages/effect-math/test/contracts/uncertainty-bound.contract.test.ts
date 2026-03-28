import { describe, expect, it } from "@effect/vitest"
import { BigDecimal, Effect, Schema } from "effect"

import { ComputationDispatchLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"
import { UncertaintyEnvelope } from "../../src/contracts/shared/UncertaintyEnvelope.js"

describe("advanced uncertainty envelope contracts", () => {
  it.effect("requires uncertainty-aware envelopes for integration dispatch", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "calculus",
        operationName: "adaptiveSimpson",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        convergence: {
          absoluteError: 1e-4,
          relativeError: 1e-3,
          iterations: 64
        },
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: true
      }).pipe(Effect.provide(ComputationDispatchLive))

      expect(plan.uncertaintyEnvelope).toStrictEqual(true)
      expect(plan.scalarKind).toStrictEqual("bigdecimal")
      expect(plan.precisionEscalationSource).toStrictEqual("escalation-order")
    }))

  it.effect("rejects float64 intervals where lower exceeds upper", () =>
    Effect.gen(function*() {
      const decoded = yield* Effect.either(
        Schema.decodeUnknown(UncertaintyEnvelope)({
          scalarKind: "float64",
          value: 1,
          absoluteError: 0,
          relativeError: 0,
          interval: {
            lower: 2,
            upper: 1
          }
        }, { onExcessProperty: "error" })
      )

      expect(decoded._tag).toStrictEqual("Left")
    }))

  it.effect("rejects bigdecimal envelopes with negative absolute error", () =>
    Effect.gen(function*() {
      const decoded = yield* Effect.either(
        Schema.decodeUnknown(UncertaintyEnvelope)({
          scalarKind: "bigdecimal",
          value: BigDecimal.unsafeFromString("1.0"),
          absoluteError: BigDecimal.unsafeFromString("-0.1"),
          relativeError: BigDecimal.unsafeFromString("0.1")
        }, { onExcessProperty: "error" })
      )

      expect(decoded._tag).toStrictEqual("Left")
    }))

  it.effect("rejects bigdecimal intervals where lower exceeds upper", () =>
    Effect.gen(function*() {
      const decoded = yield* Effect.either(
        Schema.decodeUnknown(UncertaintyEnvelope)({
          scalarKind: "bigdecimal",
          value: BigDecimal.unsafeFromString("1.0"),
          absoluteError: BigDecimal.unsafeFromString("0.1"),
          relativeError: BigDecimal.unsafeFromString("0.05"),
          interval: {
            lower: BigDecimal.unsafeFromString("2.0"),
            upper: BigDecimal.unsafeFromString("1.0")
          }
        }, { onExcessProperty: "error" })
      )

      expect(decoded._tag).toStrictEqual("Left")
    }))
})
