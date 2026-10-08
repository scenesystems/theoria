import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { FileSystem } from "effect"
import { Array as Arr, Effect, Number as Num, Struct } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as OptimizationStorage from "../../src/OptimizationStorage.js"
import * as Sampler from "../../src/Sampler.js"
import {
  encodeSnapshotConfigTrace,
  encodeSnapshotValueTrace,
  snapshotConfigTrace,
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace,
  snapshotValueTrace
} from "../helpers/optimizationSnapshots.js"

describe("recovery resume-from-storage", () => {
  it.effect("restores canonical snapshot + replay tail and matches uninterrupted deterministic baseline", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-resume-storage-"
      })
      const storageOptions = StudyStorage.fileSystemOptions(directory)
      const storage = yield* OptimizationStorage.makeFileSystem(storageOptions)

      const seed = 2301
      const totalTrials = 12
      const checkpointTrials = 5
      const replayTailTrials = 2
      const resumedTrials = Num.subtract(Num.subtract(totalTrials, checkpointTrials), replayTailTrials)

      const baselineResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed }),
          direction: "minimize",
          trials: totalTrials,
          objective: snapshotSingleObjective
        })
      )
      const stagingOptions = StudyStorage.fileSystemOptions(
        yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-recovery-resume-staging-" })
      )
      const stagedResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed }),
          direction: "minimize",
          trials: Num.sum(checkpointTrials, replayTailTrials),
          objective: snapshotSingleObjective
        })
      ).pipe(Effect.provide(OptimizationStorage.layerFileSystem(stagingOptions)))
      const stagedRecords = yield* OptimizationStorage.makeFileSystem(stagingOptions).pipe(
        Effect.flatMap((staging) => staging.loadTrialLog())
      )
      const checkpointRecord = yield* Effect.fromOption(Arr.get(stagedRecords, Num.decrement(checkpointTrials)))

      const baselineSingle = snapshotSingleObjectiveResult(baselineResult)
      const stagedSingle = snapshotSingleObjectiveResult(stagedResult)
      const baseline = yield* Effect.fromOption(baselineSingle)
      const staged = yield* Effect.fromOption(stagedSingle)

      const stagedSnapshot = yield* Optimization.snapshot(staged)
      const checkpoint = new OptimizationSnapshot.OptimizationSnapshot(Struct.assign(stagedSnapshot, {
        nextTrialNumber: checkpointTrials,
        trials: Arr.take(stagedSnapshot.trials, checkpointTrials),
        completedCount: checkpointTrials,
        samplerCheckpoint: checkpointRecord.samplerCheckpoint
      }))

      yield* storage.writeSnapshot(checkpoint)
      yield* Effect.forEach(stagedRecords, (record) => storage.appendTrial(record), { discard: true })

      const resumedResult = yield* Optimization.resumeFromStorage(
        new Optimization.StorageResumeOptions({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed }),
          direction: "minimize",
          trials: resumedTrials,
          objective: snapshotSingleObjective
        })
      ).pipe(
        Effect.provide(OptimizationStorage.layerFileSystem(storageOptions))
      )

      const resumedSingle = yield* Effect.fromOption(snapshotSingleObjectiveResult(resumedResult))

      expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(resumedSingle))).toBe(
        encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baseline))
      )
      expect(encodeSnapshotValueTrace(snapshotValueTrace(resumedSingle))).toBe(
        encodeSnapshotValueTrace(snapshotValueTrace(baseline))
      )

      const trialNumbers = Arr.map(Arr.fromIterable(resumedSingle.trials), (trial) => trial.trialNumber)

      expect(trialNumbers).toEqual(Arr.makeBy(totalTrials, (index) => index))

      const resumedSnapshot = yield* Optimization.snapshot(resumedSingle)
      expect(resumedSnapshot.nextTrialNumber).toBe(totalTrials)
      expect(resumedSnapshot.completedCount).toBe(totalTrials)
    }).pipe(Effect.provide(BunServices.layer)))
})
