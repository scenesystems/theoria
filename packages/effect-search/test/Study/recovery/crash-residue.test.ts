import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { PackageVersion, RunId } from "@scenesystems/effect-study/Artifact"
import { Array as Arr, Effect, Either, Layer, Option, Schema } from "effect"

import * as ArtifactContext from "../../../src/ArtifactContext.js"
import * as ArtifactSink from "../../../src/ArtifactSink.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { ArtifactStorageError, isSearchError } from "../../../src/SearchError.js"
import * as Study from "../../../src/Study.js"
import * as StudySnapshot from "../../../src/StudySnapshot.js"
import * as StudyStorage from "../../../src/StudyStorage.js"
import {
  asSingleObjective,
  encodeConfigTrace,
  encodeNumericTrace,
  makeSpace,
  singleConfigTrace,
  singleObjective,
  singleValueTrace
} from "../snapshot/helpers.js"

const NoopArtifactSink = Layer.succeed(ArtifactSink.ArtifactSink, { emit: () => Effect.void })

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return ArtifactContext.layer(new ArtifactContext.Options({ packageVersion, runId, studyId: "test-study" }))
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
  snapshot: StudySnapshot.Snapshot,
  replayTail: ReadonlyArray<StudySnapshot.Trial>
) =>
  Layer.succeed(StudyStorage.StudyStorage, {
    appendTrial: (_trial) => Effect.void,
    writeSnapshot: (_snapshot) => Effect.void,
    loadSnapshot: () => Effect.succeedSome(snapshot),
    loadTrialLog: () => Effect.succeed(Arr.empty<StudySnapshot.Trial>()),
    replayTrialLog: () => Effect.succeed(Arr.fromIterable(replayTail))
  })

describe("recovery crash residue", () => {
  const stageCheckpointAndTail = Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "effect-search-recovery-crash-residue-"
    })
    const storageOptions = StudyStorage.options(directory)
    const storage = yield* StudyStorage.make(storageOptions).pipe(
      Effect.provide(Layer.merge(ArtifactSink.layerFileSystem(directory), makeTestEnvelopeContextLayer))
    )

    const seed = 5519
    const totalTrials = 10
    const checkpointTrials = 5
    const replayTailTrials = 3

    const baselineResult = yield* Study.optimize({
      space: yield* makeSpace,
      sampler: Sampler.random({ seed }),
      direction: "minimize",
      trials: totalTrials,
      objective: singleObjective
    })
    const stagedResult = yield* Study.optimize({
      space: yield* makeSpace,
      sampler: Sampler.random({ seed }),
      direction: "minimize",
      trials: checkpointTrials + replayTailTrials,
      objective: singleObjective
    })
    const baseline = yield* asSingleObjective(baselineResult)
    const staged = yield* asSingleObjective(stagedResult)

    const stagedSnapshot = yield* Study.snapshot(staged)
    yield* storage.writeSnapshot(
      new StudySnapshot.Snapshot({
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

    const resume = Study.resumeFromStorage({
      space: yield* makeSpace,
      sampler: Sampler.random({ seed }),
      direction: "minimize",
      trials: totalTrials - checkpointTrials - replayTailTrials,
      objective: singleObjective
    }).pipe(
      Effect.provide(
        StudyStorage.layer(storageOptions).pipe(
          Layer.provideMerge(Layer.merge(ArtifactSink.layerFileSystem(directory), makeTestEnvelopeContextLayer))
        )
      )
    )

    return {
      baseline,
      totalTrials,
      envelopePath: path.join(directory, storageOptions.fileName),
      resume
    }
  })

  it.scoped("resumes from a checkpoint plus intact replay tail and reproduces the uninterrupted study", () =>
    Effect.gen(function*() {
      const { baseline, resume, totalTrials } = yield* stageCheckpointAndTail

      const resumed = yield* resume.pipe(Effect.flatMap(asSingleObjective))

      expect(encodeConfigTrace(yield* singleConfigTrace(resumed))).toBe(
        encodeConfigTrace(yield* singleConfigTrace(baseline))
      )
      expect(encodeNumericTrace(singleValueTrace(resumed))).toBe(encodeNumericTrace(singleValueTrace(baseline)))
      expect(Arr.map(resumed.trials, (trial) => trial.trialNumber)).toEqual(Arr.makeBy(totalTrials, (index) => index))

      const recoveredSnapshot = yield* Study.snapshot(resumed)
      expect(recoveredSnapshot.nextTrialNumber).toBe(totalTrials)
      expect(recoveredSnapshot.completedCount).toBe(totalTrials)
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a log torn by an interrupted append fails resume with a typed read error naming the line", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const { envelopePath, resume } = yield* stageCheckpointAndTail
      const intact = yield* fileSystem.readFileString(envelopePath)
      yield* fileSystem.writeFileString(envelopePath, "{\"trialNumber\":", { flag: "a" })

      const outcome = yield* Effect.either(resume)

      expect(Either.isLeft(outcome)).toBe(true)
      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(ArtifactStorageError)
        if (outcome.left instanceof ArtifactStorageError) {
          expect(outcome.left.operation).toBe("read")
          expect(outcome.left.detail).toContain(`line ${intact.split("\n").length} is not an artifact envelope`)
        }
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("fails resumeFromStorage with typed InvalidStudyConfig when snapshot is missing", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-missing-snapshot-"
      })
      const storageOptions = StudyStorage.options(directory)

      const outcome = yield* Effect.either(
        Study.resumeFromStorage({
          space: yield* makeSpace,
          sampler: Sampler.random({ seed: 61 }),
          direction: "minimize",
          trials: 2,
          objective: singleObjective
        }).pipe(
          Effect.provide(
            StudyStorage.layer(storageOptions).pipe(
              Layer.provideMerge(Layer.merge(NoopArtifactSink, makeTestEnvelopeContextLayer))
            )
          )
        )
      )

      expectInvalidStudyConfig(outcome, "requires a persisted snapshot")
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("fails resumeFromStorage with a typed read error when the persisted log is not envelopes", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-corrupt-snapshot-"
      })
      const storageOptions = StudyStorage.options(directory)
      const envelopePath = path.join(directory, storageOptions.fileName)

      yield* fileSystem.writeFileString(envelopePath, "{\"snapshotFormatVersion\":")

      const outcome = yield* Effect.either(
        Study.resumeFromStorage({
          space: yield* makeSpace,
          sampler: Sampler.random({ seed: 62 }),
          direction: "minimize",
          trials: 2,
          objective: singleObjective
        }).pipe(
          Effect.provide(
            StudyStorage.layer(storageOptions).pipe(
              Layer.provideMerge(Layer.merge(NoopArtifactSink, makeTestEnvelopeContextLayer))
            )
          )
        )
      )

      expect(Either.isLeft(outcome)).toBe(true)
      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(ArtifactStorageError)
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("fails resumeFromStorage with typed InvalidStudyConfig when replay tail introduces duplicate trial numbers", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Study.optimize({
        space: yield* makeSpace,
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

      const duplicateReplayTrial: StudySnapshot.Trial = {
        ...templateTrialOption.value,
        trialNumber: snapshot.nextTrialNumber
      }

      const outcome = yield* Effect.either(
        Study.resumeFromStorage({
          space: yield* makeSpace,
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
