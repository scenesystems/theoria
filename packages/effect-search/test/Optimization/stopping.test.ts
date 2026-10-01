import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as Scheduler from "../../src/Scheduler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    fidelity: SearchSpace.fidelity(1, 9)
  })

describe("advanced stopping conditions", () => {
  it.live("stops with durationExceeded when maxDuration elapses", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 31 }),
        direction: "minimize",
        trials: 100,
        concurrency: 1,
        maxDuration: "40 millis",
        objective: () => Effect.sleep("10 millis").pipe(Effect.as(0.5))
      })

      expect(result.completionReason).toBe("durationExceeded")
      expect(Arr.length(Arr.fromIterable(result.trials))).toBeLessThan(100)
    }))

  it.effect("stops with targetReached once the objective satisfies targetValue", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 10,
        targetValue: 0.1,
        objective: () => Effect.succeed(0.05)
      })

      expect(result.completionReason).toBe("targetReached")
      expect(Arr.length(Arr.fromIterable(result.trials))).toBe(1)
    }))

  it.effect("stops with noImprovement after the configured non-improving window", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 9 }),
        direction: "minimize",
        trials: 25,
        noImprovementWindow: 2,
        objective: () => Effect.succeed(1)
      })

      expect(result.completionReason).toBe("noImprovement")
      expect(Arr.length(Arr.fromIterable(result.trials))).toBe(3)
    }))

  it.effect("applies noImprovement stopping in scheduler studies without running full bracket budgets", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.hyperband({
        maxResource: 9,
        reductionFactor: 3,
        sampler: Sampler.random({ seed: 21 })
      })

      const result = yield* Optimization.run({
        space: yield* makeSpace(),
        scheduler,
        direction: "minimize",
        noImprovementWindow: 1,
        objective: () => Effect.succeed(1)
      })

      expect(result.completionReason).toBe("noImprovement")
      expect(Arr.length(Arr.fromIterable(result.trials))).toBeLessThan(Scheduler.totalTrials(scheduler))
    }))
})
