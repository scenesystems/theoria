import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import { argmax, expectedImprovementScore } from "../../../src/internal/tpe/expectedImprovement.js"
import { piScore } from "../../../src/samplers/Tpe/acquisition/pi.js"

describe("tpe acquisition PI", () => {
  it.effect("maps equal log densities to neutral 0.5 probability", () =>
    Effect.sync(() => {
      expect(piScore(-0.8, -0.8, Option.none())).toBeCloseTo(0.5, 12)
    }))

  it.effect("stays in [0, 1] and increases as logL - logG improves", () =>
    Effect.sync(() => {
      const weaker = piScore(-1.2, -0.3, Option.none())
      const stronger = piScore(-0.3, -1.2, Option.none())

      expect(weaker).toBeGreaterThanOrEqual(0)
      expect(weaker).toBeLessThanOrEqual(1)
      expect(stronger).toBeGreaterThanOrEqual(0)
      expect(stronger).toBeLessThanOrEqual(1)
      expect(stronger).toBeGreaterThan(weaker)
    }))

  it.effect("preserves EI ranking boundaries when estimated costs are equal", () =>
    Effect.sync(() => {
      const trace = Arr.make(
        { logL: -0.4, logG: -1.5 },
        { logL: -1.1, logG: -1.2 },
        { logL: -0.7, logG: -2.2 },
        { logL: -1.4, logG: -2.3 }
      )

      const eiScores = Arr.map(trace, ({ logL, logG }) => expectedImprovementScore(logL, logG))
      const piScores = Arr.map(trace, ({ logL, logG }) => piScore(logL, logG, Option.none()))

      expect(argmax(piScores)).toBe(argmax(eiScores))
    }))
})
