import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Result, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import type * as Pruning from "../../src/Pruning.js"
import * as Sampler from "../../src/Sampler.js"
import * as Scheduler from "../../src/Scheduler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const space = SearchSpace.make({
  x: SearchSpace.float(Num.multiply(-1, 2), 2),
  budget: SearchSpace.fidelity(1, 9)
})

const objective = (
  config: { readonly x: number; readonly budget: number },
  runtime: Pruning.Runtime
) =>
  Effect.gen(function*() {
    const resource = yield* runtime.resource.pipe(Effect.map(Option.getOrElse(() => 1)))

    const distance = Num.subtract(config.x, 0.4)
    return Num.sum(Num.multiply(distance, distance), Num.divideUnsafe(1, resource))
  })

const bestValue = <Config>(result: Optimization.Result<Config>): number =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.state.value),
    Match.tag("MultiObjective", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

describe("hyperband scheduler", () => {
  it.effect("rejects non-finite topology values", () =>
    Effect.gen(function*() {
      const invalidResource = yield* Effect.result(
        Scheduler.hyperband(
          new Scheduler.HyperbandOptions({
            maxResource: Number.NaN,
            reductionFactor: 3,
            sampler: Sampler.random()
          })
        )
      )
      const invalidReduction = yield* Effect.result(
        Scheduler.hyperband(
          new Scheduler.HyperbandOptions({
            maxResource: 9,
            reductionFactor: Number.POSITIVE_INFINITY,
            sampler: Sampler.random()
          })
        )
      )

      expect(Result.isFailure(invalidResource)).toBe(true)
      expect(Result.isFailure(invalidReduction)).toBe(true)
    }))

  it.effect("builds deterministic bracket topology", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.hyperband(
        new Scheduler.HyperbandOptions({
          maxResource: 9,
          reductionFactor: 3,
          sampler: Sampler.random({ seed: 11 })
        })
      )

      expect(scheduler.mode).toBe("hyperband")
      expect(Scheduler.totalTrials(scheduler)).toBe(22)
      expect(Arr.map(Arr.fromIterable(scheduler.brackets), (bracket) =>
        Arr.map(Arr.fromIterable(bracket.rounds), (round) =>
          round.resource))).toEqual(Arr.make(
            Arr.make(1, 3, 9),
            Arr.make(3, 9),
            Arr.of(9)
          ))
    }))

  it.effect(
    "runs bracket/round events and attaches scheduler summary to optimization result",
    () =>
      Effect.gen(function*() {
        const scheduler = yield* Scheduler.hyperband(
          new Scheduler.HyperbandOptions({
            maxResource: 9,
            reductionFactor: 3,
            sampler: Sampler.random({ seed: 21 })
          })
        )
        const events = yield* Optimization.stream(
          new Optimization.ScheduledOptions({
            space: yield* space,
            scheduler,
            direction: "minimize",
            objective
          })
        ).pipe(Stream.runCollect)
        const tags = Arr.map(Arr.fromIterable(events), (event) => event._tag)
        const result = yield* Optimization.run(
          new Optimization.ScheduledOptions({
            space: yield* space,
            scheduler,
            direction: "minimize",
            objective
          })
        )

        expect(tags).toContain("BracketStarted")
        expect(tags).toContain("RoundStarted")
        expect(tags).toContain("RoundCompleted")
        expect(tags).toContain("BracketCompleted")
        expect(Arr.last(tags)).toEqual(Option.some("Completed"))
        expect(result.trials).toHaveLength(Scheduler.totalTrials(scheduler))
        expect(Option.isSome(Option.fromNullishOr(result.schedulerSummary))).toBe(true)
        expect(bestValue(result)).toBeLessThan(0.5)
      }),
    15_000
  )
})
