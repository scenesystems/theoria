import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as Sampler from "../../src/Sampler.js"
import {
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace
} from "../helpers/optimizationSnapshots.js"

describe("OptimizationSnapshot.decodeUnknown", () => {
  it.effect("OptimizationSnapshot.decodeUnknown recomputes counters instead of trusting persisted diagnostics", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 1212 }),
        direction: "minimize",
        trials: 5,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(result)

      const snapshot = yield* Optimization.snapshot(single)

      const decoded = yield* OptimizationSnapshot.decodeUnknown({
        ...snapshot,
        nextTrialNumber: 99,
        samplerMetrics: {
          checkpointTag: "stale",
          completedCount: Num.negate(1),
          retryCountTotal: 12,
          priorCount: 8
        }
      })

      expect(decoded.nextTrialNumber).toBe(5)
      expect(decoded.samplerMetrics).toEqual({
        checkpointTag: "Random",
        completedCount: 5,
        retryCountTotal: 0,
        priorCount: 0
      })
      expect(decoded.trials).toEqual(snapshot.trials)
    }))

  it.effect("Optimization.resume preserves trial continuity with canonical snapshot payload", () =>
    Effect.gen(function*() {
      const firstLeg = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 9090 }),
        direction: "minimize",
        trials: 4,
        objective: snapshotSingleObjective
      })

      const firstSingle = yield* snapshotSingleObjectiveResult(firstLeg)

      const firstSnapshot = yield* Optimization.snapshot(firstSingle)

      const resumed = yield* Optimization.resume({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 9090 }),
        snapshot: firstSnapshot,
        direction: "minimize",
        trials: 3,
        objective: snapshotSingleObjective
      })

      const resumedSingle = yield* snapshotSingleObjectiveResult(resumed)

      const resumedSnapshot = yield* Optimization.snapshot(resumedSingle)
      expect(resumedSnapshot.nextTrialNumber).toBe(7)
      expect(Arr.map(Arr.fromIterable(resumedSingle.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ))
    }))
})
