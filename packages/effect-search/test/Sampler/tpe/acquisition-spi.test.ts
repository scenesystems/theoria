import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import { abs } from "effect-math/Numeric"

import * as Sampler from "../../../src/Sampler/index.js"
import { scoreAcquisition } from "../../../src/samplers/Tpe/acquisition/index.js"
import * as SearchSpace from "../../../src/SearchSpace/index.js"
import * as Study from "../../../src/Study/index.js"

const makeSpiSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2)
  })

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const objectiveForSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) =>
    Effect.sync(() => {
      const config = decode(raw)

      return abs(config.x - 0.35)
    })
}

describe("tpe acquisition SPI", () => {
  it.effect("dispatches built-in and custom acquisition scorers through a single contract", () =>
    Effect.sync(() => {
      const context = {
        logL: -0.4,
        logG: -1.1,
        estimatedCost: Option.none(),
        roll: Option.some(0.62)
      }

      const ei = scoreAcquisition(context, "ei")
      const pi = scoreAcquisition(context, "pi")
      const thompson = scoreAcquisition(context, "thompson")
      const custom = scoreAcquisition(
        context,
        {
          name: "magnified-gap",
          score: ({ logL, logG }) => (logL - logG) * 100
        }
      )

      expect(Number.isFinite(ei)).toBe(true)
      expect(Number.isFinite(pi)).toBe(true)
      expect(Number.isFinite(thompson)).toBe(true)
      expect(custom).toBeCloseTo(70, 12)
    }))

  it.effect(
    "keeps constrained and multi-objective study paths compatible with acquisition selection",
    () =>
      Effect.gen(function*() {
        const space = makeSpiSpace()
        const objective = objectiveForSpace(space)

        const constrained = yield* Study.optimize({
          space,
          sampler: Sampler.tpe({
            seed: 19,
            nStartupTrials: 4,
            nEiCandidates: 28,
            acquisition: "pi",
            constraints: [
              (raw) =>
                Effect.sync(() => {
                  const decode = Schema.decodeUnknownSync(space.schema)
                  const config = decode(raw)

                  return config.x - 1.2
                })
            ]
          }),
          direction: "minimize",
          trials: 14,
          objective
        })

        const constrainedOption = asSingleObjective(constrained)
        expect(Option.isSome(constrainedOption)).toBe(true)

        const multiObjective = yield* Study.optimize({
          space,
          sampler: Sampler.tpe({
            seed: 19,
            nStartupTrials: 4,
            nEiCandidates: 28,
            acquisition: "thompson"
          }),
          directions: ["minimize", "minimize"],
          trials: 12,
          objective: (raw) =>
            objective(raw).pipe(
              Effect.map((distance) => [distance, abs(distance - 0.2)])
            )
        })

        expect(multiObjective._tag).toBe("MultiObjective")

        if (multiObjective._tag === "MultiObjective") {
          expect(multiObjective.paretoFront.length).toBeGreaterThan(0)
        }
      }),
    15_000
  )
})
