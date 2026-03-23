import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Number as Num, Option, Schedule, Schema } from "effect"

import { NoSuccessfulTrials } from "../../src/Errors/index.js"
import * as Float64 from "../../src/internal/float64.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    depth: SearchSpace.int(1, 5),
    optimizer: SearchSpace.categorical(["adam", "sgd"])
  })

const decodeConfig = Schema.decodeUnknownSync(makeSpace().schema)

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const completedValues = (result: Study.SingleObjectiveResult): Array<number> =>
  result.trials.flatMap((trial) =>
    trial.state._tag === "Completed" && typeof trial.state.value === "number"
      ? [trial.state.value]
      : []
  )

describe("Study.optimize regression edge cases", () => {
  it.effect("fails with NoSuccessfulTrials when trials is zero", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Study.optimize({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 301 }),
          direction: "minimize",
          trials: 0,
          objective: () => Effect.succeed(0)
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(NoSuccessfulTrials)
      expect(outcome.left._tag).toBe("effect-search/NoSuccessfulTrials")
      if (outcome.left._tag === "effect-search/NoSuccessfulTrials") {
        expect(outcome.left.trialCount).toBe(0)
      }
    }))

  it.effect("returns a deterministic single-trial result when trials is one", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 302 }),
        direction: "minimize",
        trials: 1,
        objective: (raw) => {
          const config = decodeConfig(raw)
          return Effect.succeed(Float64.abs(config.x) + config.depth)
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      expect(result.trials).toHaveLength(1)
      expect(result.trials[0]?.trialNumber).toBe(0)
      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.bestTrial.trialNumber).toBe(0)
      expect(result.bestTrial.state.value).toBe(completedValues(result)[0])
    }))

  it.effect("keeps first completed trial as best when all objective values are identical", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 303 }),
        direction: "minimize",
        trials: 12,
        objective: () => Effect.succeed(7.5)
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const values = completedValues(result)
      const baseline = values[0] ?? Number.POSITIVE_INFINITY
      const minimum = values.reduce((best, value) => Num.min(best, value), baseline)

      expect(values).toHaveLength(12)
      expect(values.every((value) => value === 7.5)).toBe(true)
      expect(result.bestTrial.trialNumber).toBe(0)
      expect(result.bestTrial.state.value).toBe(minimum)
    }))

  it.effect("fails with NoSuccessfulTrials when every trial fails via objective error channel", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Study.optimize({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 304 }),
          direction: "minimize",
          trials: 6,
          retrySchedule: Schedule.recurs(0),
          objective: () => Effect.fail("objective-failure")
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(NoSuccessfulTrials)
      expect(outcome.left._tag).toBe("effect-search/NoSuccessfulTrials")
      if (outcome.left._tag === "effect-search/NoSuccessfulTrials") {
        expect(outcome.left.trialCount).toBe(6)
      }
    }))
})
