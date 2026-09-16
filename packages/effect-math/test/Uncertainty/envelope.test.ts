import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Uncertainty from "../../src/Uncertainty.js"

describe("Uncertainty.Envelope", () => {
  it.effect("rejects intervals whose lower endpoint exceeds the upper endpoint", () =>
    Effect.gen(function*() {
      const float64 = yield* Effect.either(
        Schema.decodeUnknown(Uncertainty.Envelope)({
          scalarKind: "float64",
          value: 1,
          absoluteError: 0,
          relativeError: 0,
          interval: { lower: 2, upper: 1 }
        }, { onExcessProperty: "error" })
      )
      const bigDecimal = yield* Effect.either(
        Schema.decodeUnknown(Uncertainty.Envelope)({
          scalarKind: "bigdecimal",
          value: "1.0",
          absoluteError: "0.1",
          relativeError: "0.05",
          interval: { lower: "2.0", upper: "1.0" }
        }, { onExcessProperty: "error" })
      )

      expect(float64._tag).toStrictEqual("Left")
      expect(bigDecimal._tag).toStrictEqual("Left")
    }))

  it.effect("rejects negative BigDecimal errors", () =>
    Effect.gen(function*() {
      const decoded = yield* Effect.either(
        Schema.decodeUnknown(Uncertainty.Envelope)({
          scalarKind: "bigdecimal",
          value: "1.0",
          absoluteError: "-0.1",
          relativeError: "0.1"
        }, { onExcessProperty: "error" })
      )

      expect(decoded._tag).toStrictEqual("Left")
    }))

  it.effect("serializes BigDecimal envelope fields to canonical decimal strings", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(Uncertainty.Envelope)({
        scalarKind: "bigdecimal",
        value: "1.00",
        absoluteError: "0.10",
        relativeError: "0.050",
        interval: { lower: "0.90", upper: "1.10" }
      }, { onExcessProperty: "error" })
      const encoded = yield* Schema.encode(Uncertainty.Envelope)(decoded)

      expect(encoded).toStrictEqual({
        scalarKind: "bigdecimal",
        value: "1",
        absoluteError: "0.1",
        relativeError: "0.05",
        interval: { lower: "0.9", upper: "1.1" }
      })
    }))
})
