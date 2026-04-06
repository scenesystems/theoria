import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number as Num, Option, Schema } from "effect"
import { abs } from "effect-math/Numeric"

import { makeRandomTrainingSpace } from "../../src/experimental/scenarios/randomTraining.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"
import * as Trial from "../../src/Trial/index.js"

const valuesFromTrials = (trials: Array<Trial.Trial<unknown>>) =>
  trials.flatMap((trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: ({ value }) =>
        Match.value(value).pipe(
          Match.when(Match.number, (entry) => [entry]),
          Match.orElse(() => [])
        ),
      Pruned: () => [],
      Failed: () => [],
      Cancelled: () => []
    })(trial.state)
  )

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const runStudy = (seed: number, direction: "minimize" | "maximize") => {
  const space = makeRandomTrainingSpace()
  const decode = Schema.decodeUnknownSync(space.schema)

  return Study.optimize({
    space,
    sampler: Sampler.random({ seed }),
    direction,
    trials: 18,
    objective: (raw) => {
      const config = decode(raw)
      const lrPenalty = abs(config.lr - 0.02) * 100
      const optimizerPenalty = config.optimizer === "adam" ? 0 : config.optimizer === "adamw" ? 0.15 : 0.35
      const batchPenalty = abs(config.batchSize - 32) / 16
      const normPenalty = config.useBatchNorm ? 0.05 : 0.2

      return Effect.succeed(lrPenalty + optimizerPenalty + batchPenalty + normPenalty)
    }
  })
}

describe("integration random study", () => {
  it.effect("runs end-to-end from search space to result", () =>
    Effect.gen(function*() {
      const optimized = yield* runStudy(101, "minimize")
      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      expect(result._tag).toBe("SingleObjective")
      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials).toHaveLength(18)
      expect(valuesFromTrials(result.trials).length).toBeGreaterThan(0)
    }))

  it.effect("is deterministic for a fixed seed", () =>
    Effect.gen(function*() {
      const left = yield* runStudy(77, "minimize")
      const right = yield* runStudy(77, "minimize")
      const leftOption = asSingleObjective(left)
      const rightOption = asSingleObjective(right)
      expect(Option.isSome(leftOption)).toBe(true)
      expect(Option.isSome(rightOption)).toBe(true)

      if (Option.isNone(leftOption) || Option.isNone(rightOption)) {
        return
      }

      expect(valuesFromTrials(leftOption.value.trials)).toEqual(valuesFromTrials(rightOption.value.trials))
      expect(leftOption.value.bestTrial.state.value).toBe(rightOption.value.bestTrial.state.value)
    }))

  it.effect("supports both minimize and maximize directions", () =>
    Effect.gen(function*() {
      const minimizeOptimized = yield* runStudy(55, "minimize")
      const maximizeOptimized = yield* runStudy(55, "maximize")
      const minimizeOption = asSingleObjective(minimizeOptimized)
      const maximizeOption = asSingleObjective(maximizeOptimized)
      expect(Option.isSome(minimizeOption)).toBe(true)
      expect(Option.isSome(maximizeOption)).toBe(true)

      if (Option.isNone(minimizeOption) || Option.isNone(maximizeOption)) {
        return
      }

      const minimizeResult = minimizeOption.value
      const maximizeResult = maximizeOption.value
      const minimizeValues = valuesFromTrials(minimizeResult.trials)
      const maximizeValues = valuesFromTrials(maximizeResult.trials)
      const minBaseline = minimizeValues[0] ?? Number.POSITIVE_INFINITY
      const maxBaseline = maximizeValues[0] ?? Number.NEGATIVE_INFINITY
      const minimum = minimizeValues.reduce((best, value) => Num.min(best, value), minBaseline)
      const maximum = maximizeValues.reduce((best, value) => Num.max(best, value), maxBaseline)

      expect(minimizeResult.bestTrial.state.value).toBe(minimum)
      expect(maximizeResult.bestTrial.state.value).toBe(maximum)
    }))
})
