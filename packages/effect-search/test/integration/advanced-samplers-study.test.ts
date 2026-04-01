import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Option, Schema } from "effect"

import { SamplerObjectiveUnsupported } from "../../src/Errors/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const objectiveSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

const objective = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) =>
    Effect.sync(() => {
      const config = decode(raw)
      return (config.x - 1.2) ** 2 + (config.y + 0.7) ** 2
    })
}

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

describe("integration advanced samplers", () => {
  it.effect("runs end-to-end optimization with CMA-ES and GP-BO samplers", () =>
    Effect.gen(function*() {
      const space = objectiveSpace()
      const optimizeObjective = objective(space)
      const cmaResult = yield* Study.minimize({
        space,
        sampler: Sampler.cmaEs({ seed: 71, sigma: 0.6, populationSize: 10 }),
        objective: optimizeObjective,
        trials: 18
      })
      const gpResult = yield* Study.minimize({
        space,
        sampler: Sampler.gpBo({ seed: 71, nStartupTrials: 4, nCandidates: 32, acquisition: "ei" }),
        objective: optimizeObjective,
        trials: 18
      })

      const cmaSingle = asSingleObjective(cmaResult)
      const gpSingle = asSingleObjective(gpResult)
      expect(Option.isSome(cmaSingle)).toBe(true)
      expect(Option.isSome(gpSingle)).toBe(true)

      if (Option.isNone(cmaSingle) || Option.isNone(gpSingle)) {
        return
      }

      expect(Number.isFinite(cmaSingle.value.bestTrial.state.value)).toBe(true)
      expect(Number.isFinite(gpSingle.value.bestTrial.state.value)).toBe(true)
      expect(cmaSingle.value.trials.length).toBe(18)
      expect(gpSingle.value.trials.length).toBe(18)
    }))

  it.effect("preserves sampler checkpoint continuity across snapshot and resume", () =>
    Effect.gen(function*() {
      const space = objectiveSpace()
      const optimizeObjective = objective(space)
      const firstLeg = yield* Study.minimize({
        space,
        sampler: Sampler.gpBo({ seed: 24, nStartupTrials: 3, nCandidates: 20, acquisition: "thompson" }),
        objective: optimizeObjective,
        trials: 8
      })
      const firstSingle = asSingleObjective(firstLeg)
      expect(Option.isSome(firstSingle)).toBe(true)

      if (Option.isNone(firstSingle)) {
        return
      }

      const snapshot = yield* Study.snapshot(firstSingle.value)
      const resumed = yield* Study.resume({
        space,
        sampler: Sampler.gpBo({ seed: 24, nStartupTrials: 3, nCandidates: 20, acquisition: "thompson" }),
        snapshot,
        direction: "minimize",
        trials: 6,
        objective: optimizeObjective
      })
      const resumedSingle = asSingleObjective(resumed)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(resumedSingle.value.trials.length).toBe(14)
      expect(resumedSingle.value.trials.map((trial) => trial.trialNumber)).toEqual([
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13
      ])
    }))

  it.effect("fails Study.optimize with typed sampler errors for unsupported multi-objective runs", () =>
    Effect.gen(function*() {
      const space = objectiveSpace()
      const decode = Schema.decodeUnknownSync(space.schema)
      const outcome = yield* Effect.either(
        Study.optimize({
          space,
          sampler: Sampler.cmaEs({ seed: 19, sigma: 0.5, populationSize: 8 }),
          directions: ["minimize", "minimize"],
          trials: 4,
          objective: (raw) => {
            const config = decode(raw)
            return Effect.succeed([config.x ** 2, config.y ** 2])
          }
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(SamplerObjectiveUnsupported)
      }
    }))
})
