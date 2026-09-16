import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as Num, Option, Schema, Stream } from "effect"

import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Study from "../../src/Study.js"
import * as Trial from "../../src/Trial.js"

const gridSpace = SearchSpace.make({
  alpha: SearchSpace.categorical(["a", "b", "c"]),
  beta: SearchSpace.categorical(["x", "y", "z", "w"]),
  useBatchNorm: SearchSpace.boolean()
})

const asSingleObjective = (result: Study.Result) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const completedConfigs = (space: SearchSpace.SearchSpace, trials: Iterable<Trial.Trial<unknown>>) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return Arr.flatMap(Arr.fromIterable(trials), (trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: () => [decode(trial.config)],
      Pruned: () => [],
      Failed: () => [],
      Cancelled: () => []
    })(trial.state))
}

const completedValues = (trials: Iterable<Trial.Trial<unknown>>) =>
  Arr.flatMap(Arr.fromIterable(trials), (trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: ({ value }) =>
        Match.value(value).pipe(
          Match.when(Match.number, (numeric) => [numeric]),
          Match.orElse(() => [])
        ),
      Pruned: () => [],
      Failed: () => [],
      Cancelled: () => []
    })(trial.state))

const keyFromConfig = (
  config: { readonly alpha: string; readonly beta: string; readonly useBatchNorm: boolean }
): string => `${config.alpha}|${config.beta}|${config.useBatchNorm}`

const objectiveForSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    const alphaPenalty = config.alpha === "a" ? 0 : config.alpha === "b" ? 0.3 : 0.6
    const betaPenalty = config.beta === "x" ? 0 : config.beta === "y" ? 0.1 : config.beta === "z" ? 0.2 : 0.4
    const normPenalty = config.useBatchNorm ? 0.05 : 0.15

    return Effect.succeed(alphaPenalty + betaPenalty + normPenalty)
  }
}

describe("integration grid study", () => {
  it.effect("uses spaceExhausted completion when trial budget exceeds finite grid size", () =>
    Effect.gen(function*() {
      const space = yield* gridSpace
      const optimized = yield* Study.optimize({
        space,
        sampler: Sampler.grid(),
        direction: "minimize",
        trials: 100,
        objective: objectiveForSpace(space)
      })

      const singleOption = asSingleObjective(optimized)
      expect(Option.isSome(singleOption)).toBe(true)

      if (Option.isNone(singleOption)) {
        return
      }

      const result = singleOption.value
      const configurations = completedConfigs(space, result.trials)
      const keys = Arr.map(configurations, keyFromConfig)
      const values = completedValues(result.trials)
      const baseline = values[0] ?? Number.POSITIVE_INFINITY
      const minimum = values.reduce((best, value) => Num.min(best, value), baseline)

      expect(result.completionReason).toBe("spaceExhausted")
      expect(result.trials).toHaveLength(24)
      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.makeBy(24, (index) => index)
      )
      expect(Arr.dedupe(keys)).toHaveLength(24)
      expect(result.bestTrial.state.value).toBe(minimum)
    }))

  it.effect("uses budgetExhausted completion when budget is within finite grid size", () =>
    Effect.gen(function*() {
      const space = yield* gridSpace
      const optimized = yield* Study.optimize({
        space,
        sampler: Sampler.grid(),
        direction: "minimize",
        trials: 10,
        objective: objectiveForSpace(space)
      })

      const singleOption = asSingleObjective(optimized)
      expect(Option.isSome(singleOption)).toBe(true)

      if (Option.isNone(singleOption)) {
        return
      }

      const result = singleOption.value

      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials).toHaveLength(10)
      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.makeBy(10, (index) => index)
      )
    }))

  it.effect("keeps optimizeStream lifecycle compatibility for grid studies", () =>
    Effect.gen(function*() {
      const space = yield* gridSpace
      const events = Chunk.toReadonlyArray(
        yield* Stream.runCollect(
          Study.optimizeStream({
            space,
            sampler: Sampler.grid(),
            direction: "minimize",
            trials: 100,
            objective: objectiveForSpace(space)
          })
        )
      )
      const tags = Arr.map(events, (event) => event._tag)
      const lastEvent = Arr.last(events)

      expect(Arr.filter(tags, (tag) => tag === "TrialStarted")).toHaveLength(24)
      expect(Arr.filter(tags, (tag) => tag === "TrialCompleted")).toHaveLength(24)
      expect(Option.map(lastEvent, (event) => event._tag)).toEqual(Option.some("Completed"))

      expect(Option.map(lastEvent, (event) => event._tag === "Completed" ? event.completionReason : "")).toEqual(
        Option.some("spaceExhausted")
      )
    }))
})
