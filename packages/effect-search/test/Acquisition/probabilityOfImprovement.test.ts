import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option } from "effect"

import * as Acquisition from "../../src/Acquisition.js"
import { argmax, expectedImprovementScore } from "../../src/internal/tpe/expectedImprovement.js"

const piScore = (logL: number, logG: number, estimatedCost: Option.Option<number>) =>
  Acquisition.score(
    new Acquisition.Context({ logL, logG, estimatedCost, roll: Option.none() }),
    Acquisition.probabilityOfImprovement
  )

describe("tpe acquisition PI", () => {
  it.effect("maps equal log densities to neutral 0.5 probability", () =>
    Effect.sync(() => {
      expect(piScore(Num.multiply(-1, 0.8), Num.multiply(-1, 0.8), Option.none())).toBeCloseTo(0.5, 12)
    }))

  it.effect("stays in [0, 1] and increases as logL - logG improves", () =>
    Effect.sync(() => {
      const weaker = piScore(Num.multiply(-1, 1.2), Num.multiply(-1, 0.3), Option.none())
      const stronger = piScore(Num.multiply(-1, 0.3), Num.multiply(-1, 1.2), Option.none())

      expect(weaker).toBeGreaterThanOrEqual(0)
      expect(weaker).toBeLessThanOrEqual(1)
      expect(stronger).toBeGreaterThanOrEqual(0)
      expect(stronger).toBeLessThanOrEqual(1)
      expect(stronger).toBeGreaterThan(weaker)
    }))

  it.effect("preserves EI ranking boundaries when estimated costs are equal", () =>
    Effect.sync(() => {
      const trace = Arr.make(
        { logL: Num.multiply(-1, 0.4), logG: Num.multiply(-1, 1.5) },
        { logL: Num.multiply(-1, 1.1), logG: Num.multiply(-1, 1.2) },
        { logL: Num.multiply(-1, 0.7), logG: Num.multiply(-1, 2.2) },
        { logL: Num.multiply(-1, 1.4), logG: Num.multiply(-1, 2.3) }
      )

      const eiScores = Arr.map(trace, ({ logL, logG }) => expectedImprovementScore(logL, logG))
      const piScores = Arr.map(trace, ({ logL, logG }) => piScore(logL, logG, Option.none()))

      expect(argmax(piScores)).toBe(argmax(eiScores))
    }))
})
