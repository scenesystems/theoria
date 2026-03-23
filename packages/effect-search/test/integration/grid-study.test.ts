import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as Num, Option, Schema, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"
import * as Trial from "../../src/Trial/index.js"

const makeGridSpace = () =>
  SearchSpace.unsafeMake({
    alpha: SearchSpace.categorical(["a", "b", "c"]),
    beta: SearchSpace.categorical(["x", "y", "z", "w"]),
    useBatchNorm: SearchSpace.boolean()
  })

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const completedConfigs = (space: SearchSpace.SearchSpace, trials: Array<Trial.Trial<unknown>>) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return trials.flatMap((trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: () => [decode(trial.config)],
      Pruned: () => [],
      Failed: () => [],
      Cancelled: () => []
    })(trial.state)
  )
}

const completedValues = (trials: Array<Trial.Trial<unknown>>) =>
  trials.flatMap((trial) =>
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
    })(trial.state)
  )

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
      const space = makeGridSpace()
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
      expect(result.trials.map((trial) => trial.trialNumber)).toEqual(Arr.makeBy(24, (index) => index))
      expect(Arr.dedupe(keys)).toHaveLength(24)
      expect(result.bestTrial.state.value).toBe(minimum)
    }))

  it.effect("uses budgetExhausted completion when budget is within finite grid size", () =>
    Effect.gen(function*() {
      const space = makeGridSpace()
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
      expect(result.trials.map((trial) => trial.trialNumber)).toEqual(Arr.makeBy(10, (index) => index))
    }))

  it.effect("keeps optimizeStream lifecycle compatibility for grid studies", () =>
    Effect.gen(function*() {
      const space = makeGridSpace()
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
      const tags = events.map((event) => event._tag)
      const lastEvent = events[events.length - 1]

      expect(tags.filter((tag) => tag === "TrialStarted")).toHaveLength(24)
      expect(tags.filter((tag) => tag === "TrialCompleted")).toHaveLength(24)
      expect(lastEvent?._tag).toBe("StudyCompleted")

      if (lastEvent?._tag === "StudyCompleted") {
        expect(lastEvent.completionReason).toBe("spaceExhausted")
      }
    }))
})
