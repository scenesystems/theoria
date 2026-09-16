import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Option } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"

import * as Acquisition from "../../src/Acquisition.js"

describe("tpe acquisition extension", () => {
  it.effect("dispatches built-in and custom acquisition scorers through a single contract", () =>
    Effect.sync(() => {
      const context = new Acquisition.Context({
        logL: Num.negate(0.4),
        logG: Num.negate(1.1),
        estimatedCost: Option.none(),
        roll: Option.some(0.62)
      })

      const ei = Acquisition.score(context, "ei")
      const pi = Acquisition.score(context, "pi")
      const thompson = Acquisition.score(context, "thompson")
      const custom = Acquisition.score(
        context,
        Acquisition.make("magnified-gap", ({ logL, logG }) => Num.multiply(Num.subtract(logL, logG), 100))
      )

      expect(Numeric.isFinite(ei)).toBe(true)
      expect(Numeric.isFinite(pi)).toBe(true)
      expect(Numeric.isFinite(thompson)).toBe(true)
      expect(custom).toBeCloseTo(70, 12)
    }))
})
