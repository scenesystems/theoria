import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Equal, Match, Number as Num, Option, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import type * as Pruning from "../../src/Pruning.js"
import * as Sampler from "../../src/Sampler.js"
import * as Scheduler from "../../src/Scheduler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const space = SearchSpace.make({
  instructionWeight: SearchSpace.float(Num.negate(1), 1),
  demoWeight: SearchSpace.float(Num.negate(1), 1),
  budget: SearchSpace.fidelity(1, 9)
})

const objective = (
  config: {
    readonly instructionWeight: number
    readonly demoWeight: number
    readonly budget: number
  },
  runtime: Pruning.Runtime
): Effect.Effect<number> =>
  Effect.gen(function*() {
    const resource = yield* runtime.resource.pipe(Effect.map(Option.getOrElse(() => 1)))
    const instructionDistance = Num.subtract(config.instructionWeight, 0.3)
    const demoDistance = Num.sum(config.demoWeight, 0.1)
    const instructionLoss = Num.multiply(instructionDistance, instructionDistance)
    const demoLoss = Num.multiply(demoDistance, demoDistance)

    return Num.sumAll(Arr.make(instructionLoss, demoLoss, Num.unsafeDivide(1, resource)))
  })

describe("integration hyperband optimization", () => {
  it.effect("executes bracketed multi-fidelity rounds with ordered resource escalation", () =>
    Effect.gen(function*() {
      const resolvedSpace = yield* space
      const scheduler = yield* Scheduler.hyperband({
        maxResource: 9,
        reductionFactor: 3,
        sampler: Sampler.random({ seed: 42 })
      })
      const events = yield* Optimization.stream({
        space: resolvedSpace,
        scheduler,
        direction: "minimize",
        objective
      }).pipe(Stream.runCollect)
      const allEvents = Chunk.toReadonlyArray(events)
      const roundResources = Arr.flatMap(allEvents, (event) =>
        Match.value(event).pipe(
          Match.tag("RoundStarted", ({ resource }) => Arr.of(resource)),
          Match.orElse(Arr.empty)
        ))
      const bracketStartCount = Arr.length(
        Arr.filter(allEvents, (event) => Equal.equals(event._tag, "BracketStarted"))
      )
      const bracketCompleteCount = Arr.length(
        Arr.filter(allEvents, (event) => Equal.equals(event._tag, "BracketCompleted"))
      )
      const result = yield* Optimization.run({
        space: resolvedSpace,
        scheduler,
        direction: "minimize",
        objective
      })

      expect(roundResources).toContain(1)
      expect(roundResources).toContain(3)
      expect(roundResources).toContain(9)
      expect(bracketStartCount).toBe(Chunk.size(scheduler.brackets))
      expect(bracketCompleteCount).toBe(Chunk.size(scheduler.brackets))
      expect(result.trials).toHaveLength(Scheduler.totalTrials(scheduler))
      expect(Option.isSome(Option.fromNullable(result.schedulerSummary))).toBe(true)
    }), 20_000)
})
