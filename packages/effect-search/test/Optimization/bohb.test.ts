import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Number as Num, Option } from "effect"

import * as Optimization from "../../src/Optimization.js"
import type * as Pruning from "../../src/Pruning.js"
import * as Scheduler from "../../src/Scheduler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const space = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(2), 2),
    budget: SearchSpace.fidelity(1, 9)
  })

const objective = (
  config: { readonly x: number; readonly budget: number },
  runtime: Pruning.Runtime
): Effect.Effect<number> =>
  Effect.gen(function*() {
    const resource = yield* runtime.resource.pipe(Effect.map(Option.getOrElse(() => 1)))

    const distance = Num.sum(config.x, 0.35)
    return Num.sum(Num.multiply(distance, distance), Num.unsafeDivide(1, resource))
  })

const bestValue = <Config>(result: Optimization.Result<Config>): number =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.state.value),
    Match.tag("MultiObjective", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

describe("bohb scheduler", () => {
  it.effect("rejects a non-finite exploration ratio", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Scheduler.bohb({
          maxResource: 9,
          reductionFactor: 3,
          explorationRatio: Number.NaN
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)
    }))

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
      const left = yield* Optimization.run({
        space: yield* space(),
        scheduler,
        direction: "minimize",
        objective
      })
      const right = yield* Optimization.run({
        space: yield* space(),
        scheduler,
        direction: "minimize",
        objective
      })

      expect(bestValue(left)).toBe(bestValue(right))
      expect(Arr.length(Arr.fromIterable(left.trials))).toBe(Scheduler.totalTrials(scheduler))
    }), 15_000)
})
