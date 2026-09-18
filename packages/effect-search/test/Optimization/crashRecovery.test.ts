import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Journal from "@scenesystems/effect-study/Journal"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Effect, Either, Layer, Number as Num, Schema, String as Str } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as OptimizationStorage from "../../src/OptimizationStorage.js"
import * as Sampler from "../../src/Sampler.js"
import { InvalidOptimizationConfig } from "../../src/SearchError.js"
import {
  encodeSnapshotConfigTrace,
  encodeSnapshotValueTrace,
  snapshotConfigTrace,
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace,
  snapshotValueTrace
} from "../helpers/optimizationSnapshots.js"

const expectInvalidOptimizationConfig = (
  outcome: Either.Either<unknown, unknown>,
  reasonFragment: string
) =>
  Schema.decodeUnknown(InvalidOptimizationConfig)(Either.getOrThrow(Either.flip(outcome))).pipe(
    Effect.tap((failure) =>
      Effect.sync(() => {
        expect(failure).toBeInstanceOf(InvalidOptimizationConfig)
        expect(failure._tag).toBe("effect-search/InvalidOptimizationConfig")
        expect(failure.reason).toContain(reasonFragment)
      })
    ),
    Effect.asVoid
  )

const storageLayerFromReplayTail = (
  snapshot: OptimizationSnapshot.OptimizationSnapshot,
  replayTail: Iterable<OptimizationSnapshot.Trial>
) =>
  Layer.succeed(OptimizationStorage.OptimizationStorage, {
    appendTrial: (_trial) => Effect.void,
    writeSnapshot: (_snapshot) => Effect.void,
    loadSnapshot: () => Effect.succeedSome(snapshot),
    loadTrialLog: () => Effect.succeed(Arr.appendAll(snapshot.trials, replayTail)),
    replayTrialLog: () => Effect.succeed(Arr.fromIterable(replayTail))
  })

describe("recovery crash residue", () => {
  const stageCheckpointAndTail = Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "effect-search-recovery-crash-residue-"
    })
    const storageOptions = StudyStorage.fileSystemOptions(directory)
    const storage = yield* OptimizationStorage.makeFileSystem(storageOptions)

    const seed = 5519
    const totalTrials = 10
    const checkpointTrials = 5
    const replayTailTrials = 3

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
    const baseline = yield* snapshotSingleObjectiveResult(baselineResult)
    const staged = yield* snapshotSingleObjectiveResult(stagedResult)

    const stagedSnapshot = yield* Optimization.snapshot(staged)
    yield* storage.writeSnapshot(
      new OptimizationSnapshot.OptimizationSnapshot({
        ...stagedSnapshot,
        nextTrialNumber: checkpointTrials,
        trials: Arr.take(stagedSnapshot.trials, checkpointTrials),
        completedCount: checkpointTrials
      })
    )
    yield* Effect.forEach(
      Arr.take(Arr.drop(stagedSnapshot.trials, checkpointTrials), replayTailTrials),
      (trial) => storage.appendTrial(trial),
      { discard: true }
    )

    const resume = Optimization.resumeFromStorage({
      space: yield* snapshotSpace,
      sampler: Sampler.random({ seed }),
      direction: "minimize",
      trials: Num.subtract(Num.subtract(totalTrials, checkpointTrials), replayTailTrials),
      objective: snapshotSingleObjective
    }).pipe(
      Effect.provide(OptimizationStorage.layerFileSystem(storageOptions))
    )

    return {
      baseline,
      totalTrials,
      journalPath: path.join(directory, storageOptions.fileName),
      resume
    }
  })

  it.scoped("resumes from a checkpoint plus intact replay tail and reproduces the uninterrupted optimization", () =>
    Effect.gen(function*() {
      const { baseline, resume, totalTrials } = yield* stageCheckpointAndTail

      const resumed = yield* resume.pipe(Effect.flatMap(snapshotSingleObjectiveResult))

      expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(resumed))).toBe(
        encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baseline))
      )
      expect(encodeSnapshotValueTrace(snapshotValueTrace(resumed))).toBe(
        encodeSnapshotValueTrace(snapshotValueTrace(baseline))
      )
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.makeBy(totalTrials, (index) => index)
      )

      const recoveredSnapshot = yield* Optimization.snapshot(resumed)
      expect(recoveredSnapshot.nextTrialNumber).toBe(totalTrials)
      expect(recoveredSnapshot.completedCount).toBe(totalTrials)
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a log torn by an interrupted append fails resume with a typed read error naming the line", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const { journalPath, resume } = yield* stageCheckpointAndTail
      const intact = yield* fileSystem.readFileString(journalPath)
      yield* fileSystem.writeFileString(journalPath, "{\"trialNumber\":", { flag: "a" })

      const outcome = yield* Effect.either(resume)
      const failure = yield* Schema.decodeUnknown(Journal.Failure)(Either.getOrThrow(Either.flip(outcome)))

      expect(failure).toBeInstanceOf(Journal.Failure)
      expect(failure._tag).toBe("effect-study/JournalError")
      expect(failure.operation).toBe("read")
      expect(failure.path).toBe(journalPath)
      expect(failure.line).toBe(Arr.length(Str.split("\n")(intact)))
      expect(failure.detail).toContain("is not a journal entry")
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("fails resumeFromStorage with typed InvalidOptimizationConfig when snapshot is missing", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-missing-snapshot-"
      })
      const storageOptions = StudyStorage.fileSystemOptions(directory)

      const outcome = yield* Effect.either(
        Optimization.resumeFromStorage({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 61 }),
          direction: "minimize",
          trials: 2,
          objective: snapshotSingleObjective
        }).pipe(
          Effect.provide(OptimizationStorage.layerFileSystem(storageOptions))
        )
      )

      yield* expectInvalidOptimizationConfig(outcome, "requires a persisted snapshot")
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("fails resumeFromStorage with a typed read error when the persisted log is not journal records", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-corrupt-snapshot-"
      })
      const storageOptions = StudyStorage.fileSystemOptions(directory)
      const journalPath = path.join(directory, storageOptions.fileName)

      yield* fileSystem.writeFileString(journalPath, "{\"_tag\":\"Snapshot\",\"payload\":")

      const outcome = yield* Effect.either(
        Optimization.resumeFromStorage({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 62 }),
          direction: "minimize",
          trials: 2,
          objective: snapshotSingleObjective
        }).pipe(
          Effect.provide(OptimizationStorage.layerFileSystem(storageOptions))
        )
      )

      const failure = yield* Schema.decodeUnknown(Journal.Failure)(Either.getOrThrow(Either.flip(outcome)))
      expect(failure).toBeInstanceOf(Journal.Failure)
      expect(failure._tag).toBe("effect-study/JournalError")
      expect(failure.operation).toBe("read")
      expect(failure.path).toBe(journalPath)
      expect(failure.line).toBe(1)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("fails resumeFromStorage with typed InvalidOptimizationConfig when replay tail introduces duplicate trial numbers", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 71 }),
        direction: "minimize",
        trials: 4,
        objective: snapshotSingleObjective
      })
      const single = yield* snapshotSingleObjectiveResult(snapshotResult)

      const snapshot = yield* Optimization.snapshot(single)
      const templateTrial = yield* Arr.head(snapshot.trials)

      const duplicateReplayTrial: OptimizationSnapshot.Trial = {
        ...templateTrial,
        trialNumber: snapshot.nextTrialNumber
      }

      const outcome = yield* Effect.either(
        Optimization.resumeFromStorage({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 71 }),
          direction: "minimize",
          trials: 1,
          objective: snapshotSingleObjective
        }).pipe(
          Effect.provide(
            storageLayerFromReplayTail(snapshot, Arr.make(duplicateReplayTrial, duplicateReplayTrial))
          )
        )
      )

      yield* expectInvalidOptimizationConfig(outcome, "duplicate trial number")
    }))
})
