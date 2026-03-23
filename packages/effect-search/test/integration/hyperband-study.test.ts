import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as Scheduler from "../../src/Scheduler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const space = () =>
  SearchSpace.unsafeMake({
    instructionWeight: SearchSpace.float(-1, 1),
    demoWeight: SearchSpace.float(-1, 1),
    budget: SearchSpace.fidelity(1, 9)
  })

const objective = (
  config: {
    readonly instructionWeight: number
    readonly demoWeight: number
    readonly budget: number
  },
  runtime: Study.ObjectiveTrialRuntime
): Effect.Effect<number> =>
  Effect.gen(function*() {
    const resource = yield* runtime.resource.pipe(Effect.map(Option.getOrElse(() => 1)))
    const instructionLoss = (config.instructionWeight - 0.3) * (config.instructionWeight - 0.3)
    const demoLoss = (config.demoWeight + 0.1) * (config.demoWeight + 0.1)

    return instructionLoss + demoLoss + 1 / resource
  })

describe("integration hyperband study", () => {
  it.effect("executes bracketed multi-fidelity rounds with ordered resource escalation", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.hyperband({
        maxResource: 9,
        reductionFactor: 3,
        sampler: Sampler.random({ seed: 42 })
      })
      const events = yield* Study.optimizeStream({
        space: space(),
        scheduler,
        direction: "minimize",
        objective
      }).pipe(Stream.runCollect)
      const allEvents = Chunk.toReadonlyArray(events)
      const roundResources = allEvents.flatMap((event) => event._tag === "RoundStarted" ? [event.resource] : [])
      const bracketStartCount = allEvents.filter((event) => event._tag === "BracketStarted").length
      const bracketCompleteCount = allEvents.filter((event) => event._tag === "BracketCompleted").length
      const result = yield* Study.optimize({
        space: space(),
        scheduler,
        direction: "minimize",
        objective
      })

      expect(roundResources).toContain(1)
      expect(roundResources).toContain(3)
      expect(roundResources).toContain(9)
      expect(bracketStartCount).toBe(scheduler.brackets.length)
      expect(bracketCompleteCount).toBe(scheduler.brackets.length)
      expect(result.trials).toHaveLength(Scheduler.totalTrials(scheduler))
      expect(Option.isSome(Option.fromNullable(result.schedulerSummary))).toBe(true)
    }), 20_000)
})
