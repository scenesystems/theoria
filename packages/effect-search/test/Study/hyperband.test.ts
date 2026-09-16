import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Number as Num, Option, Stream } from "effect"

import type * as Pruning from "../../src/Pruning.js"
import * as Sampler from "../../src/Sampler.js"
import * as Scheduler from "../../src/Scheduler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Study from "../../src/Study.js"

const space = SearchSpace.make({
  x: SearchSpace.float(-2, 2),
  budget: SearchSpace.fidelity(1, 9)
})

const objective = (
  config: SearchSpace.Type<Effect.Effect.Success<typeof space>>,
  runtime: Pruning.Runtime
): Effect.Effect<number> =>
  Effect.gen(function*() {
    const resource = yield* runtime.resource.pipe(Effect.map(Option.getOrElse(() => 1)))

    const distance = Num.subtract(config.x, 0.4)
    return Num.sum(Num.multiply(distance, distance), Num.unsafeDivide(1, resource))
  })

const bestValue = <Config>(result: Study.Result<Config>): number =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.state.value),
    Match.tag("MultiObjective", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

describe("hyperband scheduler", () => {
  it.effect("rejects non-finite topology values", () =>
    Effect.gen(function*() {
      const invalidResource = yield* Effect.either(
        Scheduler.hyperband({
          maxResource: Number.NaN,
          reductionFactor: 3,
          sampler: Sampler.random()
        })
      )
      const invalidReduction = yield* Effect.either(
        Scheduler.hyperband({
          maxResource: 9,
          reductionFactor: Number.POSITIVE_INFINITY,
          sampler: Sampler.random()
        })
      )

      expect(Either.isLeft(invalidResource)).toBe(true)
      expect(Either.isLeft(invalidReduction)).toBe(true)
    }))

  it.effect("builds deterministic bracket topology", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.hyperband({
        maxResource: 9,
        reductionFactor: 3,
        sampler: Sampler.random({ seed: 11 })
      })

      expect(scheduler.mode).toBe("hyperband")
      expect(Scheduler.totalTrials(scheduler)).toBe(22)
      expect(Arr.map(Arr.fromIterable(scheduler.brackets), (bracket) =>
        Arr.map(Arr.fromIterable(bracket.rounds), (round) =>
          round.resource))).toEqual([
          [1, 3, 9],
          [3, 9],
          [9]
        ])
    }))

  it.effect("runs bracket/round events and attaches scheduler summary to study result", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.hyperband({
        maxResource: 9,
        reductionFactor: 3,
        sampler: Sampler.random({ seed: 21 })
      })
      const events = yield* Study.optimizeStream({
        space: yield* space,
        scheduler,
        direction: "minimize",
        objective
      }).pipe(Stream.runCollect)
      const tags = Arr.map(Arr.fromIterable(events), (event) => event._tag)
      const result = yield* Study.optimize({
        space: yield* space,
        scheduler,
        direction: "minimize",
        objective
      })

      expect(tags).toContain("BracketStarted")
      expect(tags).toContain("RoundStarted")
      expect(tags).toContain("RoundCompleted")
      expect(tags).toContain("BracketCompleted")
      expect(Arr.last(tags)).toEqual(Option.some("Completed"))
      expect(result.trials).toHaveLength(Scheduler.totalTrials(scheduler))
      expect(Option.isSome(Option.fromNullable(result.schedulerSummary))).toBe(true)
      expect(bestValue(result)).toBeLessThan(0.5)
    }), 15_000)
})
