import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Predicate, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as Trial from "../../src/Trial.js"
import { makeRandomTrainingSpace } from "../fixtures/scenarios/randomTraining.js"

const valuesFromTrials = (trials: Iterable<Trial.Trial<unknown>>) =>
  Arr.flatMap(Arr.fromIterable(trials), (trial) =>
    Trial.matchState({
      Running: Arr.empty,
      Completed: ({ value }) => Option.liftPredicate(value, Predicate.isNumber).pipe(Option.toArray),
      Pruned: Arr.empty,
      Failed: Arr.empty,
      Cancelled: Arr.empty
    })(trial.state))

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const runOptimization = (seed: number, direction: "minimize" | "maximize") =>
  Effect.gen(function*() {
    const space = yield* makeRandomTrainingSpace()
    const decode = Schema.decodeUnknown(space.schema)

    return yield* Optimization.run({
      space,
      sampler: Sampler.random({ seed }),
      direction,
      trials: 18,
      objective: (raw) =>
        Effect.gen(function*() {
          const config = yield* decode(raw)
          const lrPenalty = Num.multiply(Numeric.abs(Num.subtract(config.lr, 0.02)), 100)
          const optimizerPenalty = Match.value(config.optimizer).pipe(
            Match.when("adam", () => 0),
            Match.when("adamw", () => 0.15),
            Match.orElse(() => 0.35)
          )
          const batchPenalty = Num.unsafeDivide(Numeric.abs(Num.subtract(config.batchSize, 32)), 16)
          const normPenalty = Match.value(config.useBatchNorm).pipe(
            Match.when(true, () => 0.05),
            Match.orElse(() => 0.2)
          )

          return Num.sumAll(Arr.make(lrPenalty, optimizerPenalty, batchPenalty, normPenalty))
        })
    })
  })

describe("integration random optimization", () => {
  it.effect("runs end-to-end from search space to result", () =>
    Effect.gen(function*() {
      const optimized = yield* runOptimization(101, "minimize")
      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      expect(result._tag).toBe("SingleObjective")
      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials).toHaveLength(18)
      expect(Arr.length(valuesFromTrials(result.trials))).toBeGreaterThan(0)
    }))

  it.effect("is deterministic for a fixed seed", () =>
    Effect.gen(function*() {
      const left = yield* runOptimization(77, "minimize")
      const right = yield* runOptimization(77, "minimize")
      const leftOption = asSingleObjective(left)
      const rightOption = asSingleObjective(right)
      expect(Option.isSome(leftOption)).toBe(true)
      expect(Option.isSome(rightOption)).toBe(true)
      const leftResult = yield* leftOption
      const rightResult = yield* rightOption

      expect(valuesFromTrials(leftResult.trials)).toEqual(valuesFromTrials(rightResult.trials))
      expect(leftResult.bestTrial.state.value).toBe(rightResult.bestTrial.state.value)
    }))

  it.effect("supports both minimize and maximize directions", () =>
    Effect.gen(function*() {
      const minimizeOptimized = yield* runOptimization(55, "minimize")
      const maximizeOptimized = yield* runOptimization(55, "maximize")
      const minimizeOption = asSingleObjective(minimizeOptimized)
      const maximizeOption = asSingleObjective(maximizeOptimized)
      expect(Option.isSome(minimizeOption)).toBe(true)
      expect(Option.isSome(maximizeOption)).toBe(true)
      const minimizeResult = yield* minimizeOption
      const maximizeResult = yield* maximizeOption
      const minimizeValues = valuesFromTrials(minimizeResult.trials)
      const maximizeValues = valuesFromTrials(maximizeResult.trials)
      const minBaseline = Arr.head(minimizeValues).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))
      const maxBaseline = Arr.head(maximizeValues).pipe(Option.getOrElse(() => Number.NEGATIVE_INFINITY))
      const minimum = Arr.reduce(minimizeValues, minBaseline, Num.min)
      const maximum = Arr.reduce(maximizeValues, maxBaseline, Num.max)

      expect(minimizeResult.bestTrial.state.value).toBe(minimum)
      expect(maximizeResult.bestTrial.state.value).toBe(maximum)
    }))
})
