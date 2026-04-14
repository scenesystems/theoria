import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Layer, Option, Schema } from "effect"

import {
  ArtifactSink,
  EnvelopeContextLive,
  fileSystemSink,
  PackageVersion,
  RunId
} from "../../../src/contracts/index.js"
import { isSearchError } from "../../../src/Errors/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import {
  asSingleObjective,
  encodeConfigTrace,
  encodeNumericTrace,
  singleConfigTrace,
  singleObjective,
  singleObjectiveSpace,
  singleValueTrace
} from "../snapshot/helpers.js"

const NoopArtifactSink = Layer.succeed(ArtifactSink, { emit: () => Effect.void })

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return EnvelopeContextLive({ packageVersion, runId, studyId: "test-study" })
}).pipe(Layer.unwrapEffect)

const expectInvalidStudyConfig = (
  outcome: Either.Either<unknown, unknown>,
  reasonFragment: string
): void => {
  expect(Either.isLeft(outcome)).toBe(true)

  if (Either.isRight(outcome)) {
    return
  }

  expect(isSearchError(outcome.left)).toBe(true)

  if (!isSearchError(outcome.left)) {
    return
  }

  expect(outcome.left._tag).toBe("effect-search/InvalidStudyConfig")

  if (outcome.left._tag !== "effect-search/InvalidStudyConfig") {
    return
  }

  expect(outcome.left.reason).toContain(reasonFragment)
}

const storageLayerFromReplayTail = (
  snapshot: Study.StudySnapshot,
  replayTail: ReadonlyArray<Study.SnapshotTrial>
) =>
  Layer.succeed(Study.StudyStorage, {
    appendTrial: (_trial) => Effect.void,
    writeSnapshot: (_snapshot) => Effect.void,
    loadSnapshot: () => Effect.succeed(Option.some(snapshot)),
    loadTrialLog: () => Effect.succeed(Arr.empty<Study.SnapshotTrial>()),
    replayTrialLog: () => Effect.succeed(Arr.fromIterable(replayTail))
  })

describe("recovery crash residue", () => {
  it.scoped("recovers valid replay prefix and filters corrupt tail residue deterministically", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-crash-residue-"
      })
      const storageOptions = Study.studyStorageOptions(directory)
      const storage = yield* Study.StudyStorage.allocate(storageOptions).pipe(
        Effect.provide(fileSystemSink(directory)),
        Effect.provide(makeTestEnvelopeContextLayer)
      )

      const seed = 5519
      const totalTrials = 10
      const checkpointTrials = 5
      const validReplayTailTrials = 3
      const resumedTrials = totalTrials - checkpointTrials - validReplayTailTrials

      const baselineResult = yield* Study.optimize({
        space: singleObjectiveSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: totalTrials,
        objective: singleObjective
      })
      const stagedResult = yield* Study.optimize({
        space: singleObjectiveSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: checkpointTrials + validReplayTailTrials,
        objective: singleObjective
      })

      const baselineSingle = asSingleObjective(baselineResult)
      const stagedSingle = asSingleObjective(stagedResult)
      expect(Option.isSome(baselineSingle)).toBe(true)
      expect(Option.isSome(stagedSingle)).toBe(true)

      if (Option.isNone(baselineSingle) || Option.isNone(stagedSingle)) {
        return
      }

      const stagedSnapshot = yield* Study.snapshot(stagedSingle.value)
      const checkpoint = new Study.StudySnapshot({
        ...stagedSnapshot,
        nextTrialNumber: checkpointTrials,
        trials: Arr.take(stagedSnapshot.trials, checkpointTrials),
        completedCount: checkpointTrials
      })

      yield* storage.writeSnapshot(checkpoint)

      const validReplayTail = Arr.take(
        Arr.drop(stagedSnapshot.trials, checkpointTrials),
        validReplayTailTrials
      )

      yield* Effect.forEach(validReplayTail, (trial) => storage.appendTrial(trial), { discard: true })

      const envelopePath = path.join(directory, storageOptions.envelopeFileName)

      yield* fileSystem.writeFileString(envelopePath, "{\"trialNumber\":", { flag: "a" })

      const resumedResult = yield* Study.resumeFromStorage({
        space: singleObjectiveSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: resumedTrials,
        objective: singleObjective
      }).pipe(
        Effect.provide(Study.StudyStorageLive(storageOptions)),
        Effect.provide(fileSystemSink(directory)),
        Effect.provide(makeTestEnvelopeContextLayer)
      )

      const resumedSingle = asSingleObjective(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(encodeConfigTrace(singleConfigTrace(resumedSingle.value))).toBe(
        encodeConfigTrace(singleConfigTrace(baselineSingle.value))
      )
      expect(encodeNumericTrace(singleValueTrace(resumedSingle.value))).toBe(
        encodeNumericTrace(singleValueTrace(baselineSingle.value))
      )

      const trialNumbers = Arr.map(resumedSingle.value.trials, (trial) => trial.trialNumber)

      expect(trialNumbers).toEqual(Arr.makeBy(totalTrials, (index) => index))

      const recoveredSnapshot = yield* Study.snapshot(resumedSingle.value)

      expect(recoveredSnapshot.nextTrialNumber).toBe(totalTrials)
      expect(recoveredSnapshot.completedCount).toBe(totalTrials)
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("fails resumeFromStorage with typed InvalidStudyConfig when snapshot is missing", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-missing-snapshot-"
      })
      const storageOptions = Study.studyStorageOptions(directory)

      const outcome = yield* Effect.either(
        Study.resumeFromStorage({
          space: singleObjectiveSpace,
          sampler: Sampler.random({ seed: 61 }),
          direction: "minimize",
          trials: 2,
          objective: singleObjective
        }).pipe(
          Effect.provide(Study.StudyStorageLive(storageOptions)),
          Effect.provide(NoopArtifactSink),
          Effect.provide(makeTestEnvelopeContextLayer)
        )
      )

      expectInvalidStudyConfig(outcome, "requires a persisted snapshot")
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("fails resumeFromStorage with typed InvalidStudyConfig when persisted snapshot payload is corrupt", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-corrupt-snapshot-"
      })
      const storageOptions = Study.studyStorageOptions(directory)
      const envelopePath = path.join(directory, storageOptions.envelopeFileName)

      yield* fileSystem.writeFileString(envelopePath, "{\"snapshotFormatVersion\":")

      const outcome = yield* Effect.either(
        Study.resumeFromStorage({
          space: singleObjectiveSpace,
          sampler: Sampler.random({ seed: 62 }),
          direction: "minimize",
          trials: 2,
          objective: singleObjective
        }).pipe(
          Effect.provide(Study.StudyStorageLive(storageOptions)),
          Effect.provide(NoopArtifactSink),
          Effect.provide(makeTestEnvelopeContextLayer)
        )
      )

      expectInvalidStudyConfig(outcome, "requires a persisted snapshot")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("fails resumeFromStorage with typed InvalidStudyConfig when replay tail introduces duplicate trial numbers", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Study.optimize({
        space: singleObjectiveSpace,
        sampler: Sampler.random({ seed: 71 }),
        direction: "minimize",
        trials: 4,
        objective: singleObjective
      })
      const single = asSingleObjective(snapshotResult)

      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const templateTrialOption = Option.fromNullable(snapshot.trials[0])

      if (Option.isNone(templateTrialOption)) {
        return
      }

      const duplicateReplayTrial: Study.SnapshotTrial = {
        ...templateTrialOption.value,
        trialNumber: snapshot.nextTrialNumber
      }

      const outcome = yield* Effect.either(
        Study.resumeFromStorage({
          space: singleObjectiveSpace,
          sampler: Sampler.random({ seed: 71 }),
          direction: "minimize",
          trials: 1,
          objective: singleObjective
        }).pipe(
          Effect.provide(
            storageLayerFromReplayTail(snapshot, Arr.make(duplicateReplayTrial, duplicateReplayTrial))
          )
        )
      )

      expectInvalidStudyConfig(outcome, "duplicate trial number")
    }))
})
