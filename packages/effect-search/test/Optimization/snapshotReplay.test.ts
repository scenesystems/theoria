import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Schema, String as Str } from "effect"

import type { Direction } from "../../src/Direction.js"
import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as Sampler from "../../src/Sampler.js"
import {
  encodeMultiObjectiveConfigTrace,
  encodeObjectiveVectorTrace,
  encodeSnapshotConfigTrace,
  encodeSnapshotValueTrace,
  multiObjectiveConfigTrace,
  multiObjectiveSnapshotSpace,
  multiObjectiveValueTrace,
  paretoObjectiveValueTrace,
  snapshotConfigTrace,
  snapshotMultiObjectiveResult,
  snapshotObjectiveVector,
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace,
  snapshotValueTrace
} from "../helpers/optimizationSnapshots.js"

describe("Optimization snapshot-resume metadata and replay parity", () => {
  it.effect("captures canonical snapshot metadata and continues trial numbering", () =>
    Effect.gen(function*() {
      const seed = 501
      const space = yield* snapshotSpace
      const sampler = Sampler.random({ seed })
      const initialResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space,
          sampler,
          direction: "minimize",
          trials: 6,
          objective: snapshotSingleObjective
        })
      )

      const initialSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(initialResult))

      const snapshot = yield* Optimization.snapshot(initialSingle)

      expect(Str.length(snapshot.spaceFingerprint)).toBeGreaterThan(0)
      expect(snapshot.objectiveSpec._tag).toBe("Single")
      expect(snapshot.stopMode).toBe("Drain")
      expect(snapshot.samplerKind._tag).toBe("Random")
      expect(snapshot.samplerCheckpoint._tag).toBe("Random")
      expect(snapshot.nextTrialNumber).toBe(6)
      expect(snapshot.completedCount).toBe(6)

      const metadata = yield* Schema.encodeEffect(OptimizationSnapshot.Metadata)(snapshot).pipe(
        Effect.flatMap(Schema.decodeEffect(OptimizationSnapshot.Metadata))
      )
      expect(metadata.spaceFingerprint).toBe(snapshot.spaceFingerprint)

      const resumedResult = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space,
          sampler,
          snapshot,
          direction: "minimize",
          trials: 4,
          objective: snapshotSingleObjective
        })
      )

      const resumedSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(resumedResult))

      expect(resumedSingle.trials).toHaveLength(10)
      expect(Arr.map(Arr.fromIterable(resumedSingle.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9
      ))
      expect(resumedSingle.bestTrial.state.value).toBeLessThanOrEqual(initialSingle.bestTrial.state.value)
    }))

  it.effect("proves deterministic parity for random sampler N+M replay", () =>
    Effect.gen(function*() {
      const seed = 991
      const totalTrials = 12
      const firstLegTrials = 7
      const secondLegTrials = Num.subtract(totalTrials, firstLegTrials)
      const baselineResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed }),
          direction: "minimize",
          trials: totalTrials,
          objective: snapshotSingleObjective
        })
      )
      const firstLegResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed }),
          direction: "minimize",
          trials: firstLegTrials,
          objective: snapshotSingleObjective
        })
      )

      const baselineSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(baselineResult))
      const firstLegSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(firstLegResult))

      const snapshot = yield* Optimization.snapshot(firstLegSingle)
      const resumedResult = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed }),
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          objective: snapshotSingleObjective
        })
      )
      const resumedSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(resumedResult))

      expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(resumedSingle))).toBe(
        encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baselineSingle))
      )
      expect(encodeSnapshotValueTrace(snapshotValueTrace(resumedSingle))).toBe(
        encodeSnapshotValueTrace(snapshotValueTrace(baselineSingle))
      )
      expect(resumedSingle.bestTrial.trialNumber).toBe(baselineSingle.bestTrial.trialNumber)
      expect(resumedSingle.bestTrial.state.value).toBe(baselineSingle.bestTrial.state.value)
    }))

  it.effect("proves deterministic parity for single-objective TPE N+M replay", () =>
    Effect.gen(function*() {
      const options = new Sampler.TpeOptions({
        seed: 313,
        nStartupTrials: 4,
        nEiCandidates: 16
      })
      const totalTrials = 8
      const firstLegTrials = 5
      const secondLegTrials = Num.subtract(totalTrials, firstLegTrials)
      const baselineResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.tpe(options),
          direction: "minimize",
          trials: totalTrials,
          objective: snapshotSingleObjective
        })
      )
      const firstLegResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.tpe(options),
          direction: "minimize",
          trials: firstLegTrials,
          objective: snapshotSingleObjective
        })
      )

      const baselineSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(baselineResult))
      const firstLegSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(firstLegResult))

      const snapshot = yield* Optimization.snapshot(firstLegSingle)
      const resumedResult = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.tpe(options),
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          objective: snapshotSingleObjective
        })
      )
      const resumedSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(resumedResult))

      expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(resumedSingle))).toBe(
        encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baselineSingle))
      )
      expect(encodeSnapshotValueTrace(snapshotValueTrace(resumedSingle))).toBe(
        encodeSnapshotValueTrace(snapshotValueTrace(baselineSingle))
      )
      expect(resumedSingle.bestTrial.trialNumber).toBe(baselineSingle.bestTrial.trialNumber)
      expect(resumedSingle.bestTrial.state.value).toBe(baselineSingle.bestTrial.state.value)
    }))

  it.effect("proves deterministic parity for multi-objective TPE N+M replay", () =>
    Effect.gen(function*() {
      const options = new Sampler.TpeOptions({
        seed: 404,
        nStartupTrials: 4,
        nEiCandidates: 16
      })
      const totalTrials = 8
      const firstLegTrials = 5
      const secondLegTrials = Num.subtract(totalTrials, firstLegTrials)
      const baselineResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* multiObjectiveSnapshotSpace,
          sampler: Sampler.tpe(options),
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: totalTrials,
          objective: snapshotObjectiveVector
        })
      )
      const firstLegResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* multiObjectiveSnapshotSpace,
          sampler: Sampler.tpe(options),
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: firstLegTrials,
          objective: snapshotObjectiveVector
        })
      )

      const baselineMulti = yield* Effect.fromOption(snapshotMultiObjectiveResult(baselineResult))
      const firstLegMulti = yield* Effect.fromOption(snapshotMultiObjectiveResult(firstLegResult))

      const snapshot = yield* Optimization.snapshot(firstLegMulti)
      const resumedResult = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space: yield* multiObjectiveSnapshotSpace,
          sampler: Sampler.tpe(options),
          snapshot,
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: secondLegTrials,
          objective: snapshotObjectiveVector
        })
      )
      const resumedMulti = yield* Effect.fromOption(snapshotMultiObjectiveResult(resumedResult))

      expect(encodeMultiObjectiveConfigTrace(yield* multiObjectiveConfigTrace(resumedMulti))).toBe(
        encodeMultiObjectiveConfigTrace(yield* multiObjectiveConfigTrace(baselineMulti))
      )
      expect(encodeObjectiveVectorTrace(multiObjectiveValueTrace(resumedMulti))).toBe(
        encodeObjectiveVectorTrace(multiObjectiveValueTrace(baselineMulti))
      )
      expect(Arr.map(Arr.fromIterable(resumedMulti.paretoFront), (trial) => trial.trialNumber)).toEqual(
        Arr.map(Arr.fromIterable(baselineMulti.paretoFront), (trial) => trial.trialNumber)
      )
      expect(encodeObjectiveVectorTrace(paretoObjectiveValueTrace(resumedMulti))).toBe(
        encodeObjectiveVectorTrace(paretoObjectiveValueTrace(baselineMulti))
      )
    }))
})
