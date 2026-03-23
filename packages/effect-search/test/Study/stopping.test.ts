import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as Scheduler from "../../src/Scheduler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    fidelity: SearchSpace.fidelity(1, 9)
  })

describe("advanced stopping conditions", () => {
  it.live("stops with durationExceeded when maxDuration elapses", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 31 }),
        direction: "minimize",
        trials: 100,
        concurrency: 1,
        maxDuration: "40 millis",
        objective: () => Effect.sleep("10 millis").pipe(Effect.as(0.5))
      })

      expect(result.completionReason).toBe("durationExceeded")
      expect(result.trials.length).toBeLessThan(100)
    }))

  it.effect("stops with targetReached once the objective satisfies targetValue", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 10,
        targetValue: 0.1,
        objective: () => Effect.succeed(0.05)
      })

      expect(result.completionReason).toBe("targetReached")
      expect(result.trials.length).toBe(1)
    }))

  it.effect("stops with noImprovement after the configured non-improving window", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 9 }),
        direction: "minimize",
        trials: 25,
        noImprovementWindow: 2,
        objective: () => Effect.succeed(1)
      })

      expect(result.completionReason).toBe("noImprovement")
      expect(result.trials.length).toBe(3)
    }))

  it.effect("applies noImprovement stopping in scheduler studies without running full bracket budgets", () =>
    Effect.gen(function*() {
      const scheduler = yield* Scheduler.hyperband({
        maxResource: 9,
        reductionFactor: 3,
        sampler: Sampler.random({ seed: 21 })
      })

      const result = yield* Study.optimize({
        space: makeSpace(),
        scheduler,
        direction: "minimize",
        noImprovementWindow: 1,
        objective: () => Effect.succeed(1)
      })

      expect(result.completionReason).toBe("noImprovement")
      expect(result.trials.length).toBeLessThan(Scheduler.totalTrials(scheduler))
    }))
})
