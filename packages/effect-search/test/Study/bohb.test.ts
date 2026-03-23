import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option } from "effect"

import * as Scheduler from "../../src/Scheduler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const space = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    budget: SearchSpace.fidelity(1, 9)
  })

const objective = (
  config: { readonly x: number; readonly budget: number },
  runtime: Study.ObjectiveTrialRuntime
): Effect.Effect<number> =>
  Effect.gen(function*() {
    const resource = yield* runtime.resource.pipe(Effect.map(Option.getOrElse(() => 1)))

    return (config.x + 0.35) * (config.x + 0.35) + 1 / resource
  })

const bestValue = <Config>(result: Study.StudyResult<Config>): number =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.state.value),
    Match.tag("MultiObjective", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

describe("bohb scheduler", () => {
  it.effect("constructs bohb scheduler with default exploration policy", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.bohb({
        maxResource: 9,
        reductionFactor: 3,
        seed: 7,
        tpeOptions: {
          seed: 7,
          nStartupTrials: 4,
          nEiCandidates: 16
        }
      })

      expect(scheduler.mode).toBe("bohb")
      expect(scheduler.randomFraction).toBe(0.33)
      expect(Scheduler.totalTrials(scheduler)).toBeGreaterThan(0)
    }))

  it.effect("is deterministic for identical BOHB seeds", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.bohb({
        maxResource: 9,
        reductionFactor: 3,
        seed: 13,
        tpeOptions: {
          seed: 13,
          nStartupTrials: 5,
          nEiCandidates: 24
        }
      })
      const left = yield* Study.optimize({
        space: space(),
        scheduler,
        direction: "minimize",
        objective
      })
      const right = yield* Study.optimize({
        space: space(),
        scheduler,
        direction: "minimize",
        objective
      })

      expect(bestValue(left)).toBe(bestValue(right))
      expect(left.trials.length).toBe(Scheduler.totalTrials(scheduler))
    }), 15_000)
})
