import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Option, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeTypedSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(0.001, 0.1),
    optimizer: SearchSpace.categorical(["adam", "sgd"])
  })

const expectTypedConfig = (config: { readonly lr: number; readonly optimizer: "adam" | "sgd" }) => config

describe("Study typed results", () => {
  it.effect("infers objective config and threads it into StudyResult.bestTrial.config", () =>
    Effect.gen(function*() {
      const space = makeTypedSpace()
      const optimized = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 13 }),
        direction: "minimize",
        trials: 8,
        objective: (config) => {
          const typed = expectTypedConfig(config)
          return Effect.succeed(typed.lr + (typed.optimizer === "adam" ? 0 : 1))
        }
      })
      const typedResult: Study.StudyResult<SearchSpace.Type<typeof space>> = optimized

      const singleObjective = yield* Option.liftPredicate(
        typedResult,
        (result) => result._tag === "SingleObjective"
      )
      const typedBestConfig = expectTypedConfig(singleObjective.bestTrial.config)

      expect(typedBestConfig.lr).toBeGreaterThanOrEqual(0.001)
    }))

  it.effect("infers objective config for optimizeStream without explicit annotations", () =>
    Effect.gen(function*() {
      const space = makeTypedSpace()
      const stream = Study.optimizeStream({
        space,
        sampler: Sampler.random({ seed: 5 }),
        direction: "minimize",
        trials: 1,
        objective: (config) => {
          const typed = expectTypedConfig(config)
          return Effect.succeed(typed.lr)
        }
      })
      const events = Chunk.toReadonlyArray(yield* Stream.runCollect(stream))

      expect(events.map((event) => event._tag)).toEqual([
        "TrialStarted",
        "TrialCompleted",
        "BestUpdated",
        "StudyCompleted"
      ])
    }))

  it.effect("threads config type into MultiObjectiveResult.paretoFront", () =>
    Effect.gen(function*() {
      const space = makeTypedSpace()
      const optimized = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 21 }),
        directions: ["minimize", "maximize"],
        trials: 10,
        objective: (config) => {
          const typed = expectTypedConfig(config)
          return Effect.succeed([typed.lr, typed.optimizer === "adam" ? 1 : 0])
        }
      })

      const multiObjective = yield* Option.liftPredicate(
        optimized,
        (result) => result._tag === "MultiObjective"
      )
      const firstPareto = yield* Arr.last(multiObjective.paretoFront)
      const typedParetoConfig = expectTypedConfig(firstPareto.config)

      expect(typedParetoConfig.optimizer === "adam" || typedParetoConfig.optimizer === "sgd").toBe(true)
    }))
})
