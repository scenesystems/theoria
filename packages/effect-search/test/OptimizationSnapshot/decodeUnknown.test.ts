import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Result, Schema, Struct } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as Sampler from "../../src/Sampler.js"
import {
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace
} from "../helpers/optimizationSnapshots.js"

describe("OptimizationSnapshot.decodeUnknown", () => {
  it.effect("rejects invalid derived diagnostics through its typed failure channel", () =>
    Effect.gen(function*() {
      const space = yield* snapshotSpace
      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
          space,
          sampler: Sampler.random({ seed: 39 }),
          trials: 1,
          objective: snapshotSingleObjective
        })
      )
      const snapshot = yield* Optimization.snapshot(result).pipe(
        Effect.flatMap(Schema.encodeEffect(OptimizationSnapshot.OptimizationSnapshot))
      )
      const first = yield* Effect.fromOption(Arr.head(snapshot.trials))
      const corruptTrials = Arr.make(
        Struct.assign(first, { trialNumber: 9007199254740991 }),
        Struct.assign(first, { state: { _tag: "Completed", value: 1, duration: 0, retryCount: -1 } }),
        Struct.assign(first, { state: { _tag: "Completed", value: 1, duration: Infinity, retryCount: 0 } })
      )
      yield* Effect.forEach(corruptTrials, (trial) =>
        Effect.gen(function*() {
          const outcome = yield* Effect.result(
            OptimizationSnapshot.decodeUnknown(Struct.assign(snapshot, { trials: Arr.of(trial) }))
          )
          expect(Result.isFailure(outcome)).toBe(true)
        }))
    }))

  it.effect.prop("derives completed counts from trials, regardless of persisted counters", {
    count: Schema.Int.check(Schema.isBetween({ minimum: -100, maximum: 100 }))
  }, ({ count }) =>
    Effect.gen(function*() {
      const space = yield* snapshotSpace
      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
          space,
          sampler: Sampler.random({ seed: 41 }),
          trials: 2,
          objective: snapshotSingleObjective
        })
      )
      const snapshot = yield* Optimization.snapshot(result).pipe(
        Effect.flatMap(Schema.encodeEffect(OptimizationSnapshot.OptimizationSnapshot))
      )
      const decoded = yield* OptimizationSnapshot.decodeUnknown(Struct.assign(snapshot, { completedCount: count }))
      expect(decoded.completedCount).toBe(2)
      expect(decoded.samplerMetrics.completedCount).toBe(2)
      const first = yield* Effect.fromOption(Arr.head(snapshot.trials))
      expect(Result.isFailure(
        yield* Effect.result(OptimizationSnapshot.decodeUnknown(Struct.assign(snapshot, {
          trials: Arr.make(first, first)
        })))
      )).toBe(true)
    }), { arbitrary: { seed: 41, runs: 20 } })

  it.effect("OptimizationSnapshot.decodeUnknown recomputes counters instead of trusting persisted diagnostics", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 1212 }),
          direction: "minimize",
          trials: 5,
          objective: snapshotSingleObjective
        })
      )

      const single = yield* Effect.fromOption(snapshotSingleObjectiveResult(result))

      const snapshot = yield* Optimization.snapshot(single).pipe(
        Effect.flatMap(Schema.encodeEffect(OptimizationSnapshot.OptimizationSnapshot))
      )

      const decoded = yield* OptimizationSnapshot.decodeUnknown(Struct.assign(snapshot, {
        nextTrialNumber: 99,
        samplerMetrics: {
          checkpointTag: "stale",
          completedCount: Num.multiply(-1, 1),
          retryCountTotal: 12,
          priorCount: 8
        }
      }))

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
      const firstLeg = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 9090 }),
          direction: "minimize",
          trials: 4,
          objective: snapshotSingleObjective
        })
      )

      const firstSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(firstLeg))

      const firstSnapshot = yield* Optimization.snapshot(firstSingle)

      const resumed = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 9090 }),
          snapshot: firstSnapshot,
          direction: "minimize",
          trials: 3,
          objective: snapshotSingleObjective
        })
      )

      const resumedSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(resumed))

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
