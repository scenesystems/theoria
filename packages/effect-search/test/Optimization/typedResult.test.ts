import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Schema,
  Stream
} from "effect"

import type { Direction } from "../../src/Direction.js"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeTypedSpace = () =>
  SearchSpace.make({
    lr: SearchSpace.float(0.001, 0.1),
    optimizer: SearchSpace.categorical(Schema.Literal("adam", "sgd").literals)
  })

const expectTypedConfig = (config: { readonly lr: number; readonly optimizer: "adam" | "sgd" }) => config

const singleObjectiveResult = <Config>(
  result: Optimization.Result<Config>
): Option.Option<Optimization.SingleObjectiveResult<Config>> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none<Optimization.SingleObjectiveResult<Config>>())
  )

const multiObjectiveResult = <Config>(
  result: Optimization.Result<Config>
): Option.Option<Optimization.MultiObjectiveResult<Config>> =>
  Match.value(result).pipe(
    Match.tag("MultiObjective", (multi) => Option.some(multi)),
    Match.orElse(() => Option.none<Optimization.MultiObjectiveResult<Config>>())
  )

describe("Optimization typed results", () => {
  it.effect("infers objective config and threads it into Result.bestTrial.config", () =>
    Effect.gen(function*() {
      const space = yield* makeTypedSpace()
      const optimized = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 13 }),
        direction: "minimize",
        trials: 8,
        objective: (config) => {
          const typed = expectTypedConfig(config)
          return Effect.succeed(Num.sum(
            typed.lr,
            Match.value(typed.optimizer).pipe(
              Match.when("adam", () => 0),
              Match.orElse(() => 1)
            )
          ))
        }
      })
      const typedResult: Optimization.Result<SearchSpace.Type<typeof space>> = optimized

      const singleObjective = yield* singleObjectiveResult(typedResult)
      const typedBestConfig = expectTypedConfig(singleObjective.bestTrial.config)

      expect(typedBestConfig.lr).toBeGreaterThanOrEqual(0.001)
    }))

  it.effect("infers objective config for stream without explicit annotations", () =>
    Effect.gen(function*() {
      const space = yield* makeTypedSpace()
      const stream = Optimization.stream({
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

      expect(Arr.map(events, (event) => event._tag)).toEqual(Arr.make(
        "TrialStarted",
        "TrialCompleted",
        "BestUpdated",
        "Completed"
      ))
    }))

  it.effect("threads config type into MultiObjectiveResult.paretoFront", () =>
    Effect.gen(function*() {
      const space = yield* makeTypedSpace()
      const optimized = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 21 }),
        directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "maximize"),
        trials: 10,
        objective: (config) => {
          const typed = expectTypedConfig(config)
          return Effect.succeed(Arr.make(
            typed.lr,
            Match.value(typed.optimizer).pipe(
              Match.when("adam", () => 1),
              Match.orElse(() => 0)
            )
          ))
        }
      })

      const multiObjective = yield* multiObjectiveResult(optimized)
      const firstPareto = yield* Arr.last(Arr.fromIterable(multiObjective.paretoFront))
      const typedParetoConfig = expectTypedConfig(firstPareto.config)

      expect(Bool.or(
        Equal.equals(typedParetoConfig.optimizer, "adam"),
        Equal.equals(typedParetoConfig.optimizer, "sgd")
      )).toBe(true)
    }))
})
