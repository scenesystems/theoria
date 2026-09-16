import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Effect, Number as Num } from "effect"

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
  it.scoped("restores canonical snapshot + replay tail and matches uninterrupted deterministic baseline", () =>
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

      const baselineResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: totalTrials,
        objective: snapshotSingleObjective
      })
      const stagedResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: Num.sum(checkpointTrials, replayTailTrials),
        objective: snapshotSingleObjective
      })

      const baselineSingle = snapshotSingleObjectiveResult(baselineResult)
      const stagedSingle = snapshotSingleObjectiveResult(stagedResult)
      const baseline = yield* baselineSingle
      const staged = yield* stagedSingle

      const stagedSnapshot = yield* Optimization.snapshot(staged)
      const checkpoint = new OptimizationSnapshot.OptimizationSnapshot({
        ...stagedSnapshot,
        nextTrialNumber: checkpointTrials,
        trials: Arr.take(stagedSnapshot.trials, checkpointTrials),
        completedCount: checkpointTrials
      })

      yield* storage.writeSnapshot(checkpoint)
      yield* Effect.forEach(stagedSnapshot.trials, (trial) => storage.appendTrial(trial), { discard: true })

      const resumedResult = yield* Optimization.resumeFromStorage({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: resumedTrials,
        objective: snapshotSingleObjective
      }).pipe(
        Effect.provide(OptimizationStorage.layerFileSystem(storageOptions))
      )

      const resumedSingle = yield* snapshotSingleObjectiveResult(resumedResult)

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
    }).pipe(Effect.provide(BunContext.layer)))
})
