import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Option } from "effect"

import * as Acquisition from "../../../src/Acquisition.js"

describe("tpe acquisition registry", () => {
  it.effect("resolves the default acquisition when no override is provided", () =>
    Effect.sync(() => {
      const resolved = Acquisition.resolve()
      const context = new Acquisition.Context({
        logL: -0.3,
        logG: -0.8,
        estimatedCost: Option.none(),
        roll: Option.none()
      })

      expect(resolved.name).toBe(Acquisition.defaultName)
      expect(Acquisition.scoreDefault(context)).toBeCloseTo(
        Acquisition.score(context, Acquisition.defaultName),
        12
      )
    }))

  it.effect("accepts additive custom acquisition implementations without mutating built-ins", () =>
    Effect.sync(() => {
      const custom = Acquisition.resolve(
        Acquisition.make("custom-gap", ({ logL, logG }) => Num.multiply(Num.subtract(logL, logG), 10))
      )

      expect(custom.name).toBe("custom-gap")
      expect(
        custom.score({
          logL: -0.1,
          logG: -0.6,
          estimatedCost: Option.none(),
          roll: Option.none()
        })
      ).toBeCloseTo(5, 12)
      expect(Acquisition.resolve("ei").name).toBe("ei")
    }))
})
