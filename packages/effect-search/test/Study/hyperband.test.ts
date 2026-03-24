import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Match, Option, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
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

    return (config.x - 0.4) * (config.x - 0.4) + 1 / resource
  })

const bestValue = <Config>(result: Study.StudyResult<Config>): number =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.state.value),
    Match.tag("MultiObjective", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

describe("hyperband scheduler", () => {
  it.effect("builds deterministic bracket topology", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.hyperband({
        maxResource: 9,
        reductionFactor: 3,
        sampler: Sampler.random({ seed: 11 })
      })

      expect(scheduler.mode).toBe("hyperband")
      expect(Scheduler.totalTrials(scheduler)).toBe(22)
      expect(scheduler.brackets.map((bracket) => bracket.rounds.map((round) => round.resource))).toEqual([
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
        space: space(),
        scheduler,
        direction: "minimize",
        objective
      }).pipe(Stream.runCollect)
      const tags = Chunk.toReadonlyArray(events).map((event) => event._tag)
      const result = yield* Study.optimize({
        space: space(),
        scheduler,
        direction: "minimize",
        objective
      })

      expect(tags).toContain("BracketStarted")
      expect(tags).toContain("RoundStarted")
      expect(tags).toContain("RoundCompleted")
      expect(tags).toContain("BracketCompleted")
      expect(tags[tags.length - 1]).toBe("StudyCompleted")
      expect(result.trials).toHaveLength(Scheduler.totalTrials(scheduler))
      expect(Option.isSome(Option.fromNullable(result.schedulerSummary))).toBe(true)
      expect(bestValue(result)).toBeLessThan(0.5)
    }), 15_000)
})
