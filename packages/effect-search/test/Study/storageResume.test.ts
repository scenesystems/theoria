import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { PackageVersion, RunId } from "@scenesystems/effect-study/Artifact"
import { Array as Arr, Effect, Layer, Option, Schema } from "effect"

import * as ArtifactContext from "../../src/ArtifactContext.js"
import * as ArtifactSink from "../../src/ArtifactSink.js"
import * as Sampler from "../../src/Sampler.js"
import * as Study from "../../src/Study.js"
import * as StudySnapshot from "../../src/StudySnapshot.js"
import * as StudyStorage from "../../src/StudyStorage.js"
import {
  encodeSnapshotConfigTrace,
  encodeSnapshotValueTrace,
  snapshotConfigTrace,
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace,
  snapshotValueTrace
} from "../helpers/studySnapshots.js"

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return ArtifactContext.layer(new ArtifactContext.Options({ packageVersion, runId, studyId: "test-study" }))
}).pipe(Layer.unwrapEffect)

describe("recovery resume-from-storage", () => {
  it.scoped("restores canonical snapshot + replay tail and matches uninterrupted deterministic baseline", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-resume-storage-"
      })
      const storageOptions = StudyStorage.options(directory)
      const storage = yield* StudyStorage.make(storageOptions).pipe(
        Effect.provide(Layer.merge(ArtifactSink.layerFileSystem(directory), makeTestEnvelopeContextLayer))
      )

      const seed = 2301
      const totalTrials = 12
      const checkpointTrials = 5
      const replayTailTrials = 2
      const resumedTrials = totalTrials - checkpointTrials - replayTailTrials

      const baselineResult = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: totalTrials,
        objective: snapshotSingleObjective
      })
      const stagedResult = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: checkpointTrials + replayTailTrials,
        objective: snapshotSingleObjective
      })

      const baselineSingle = snapshotSingleObjectiveResult(baselineResult)
      const stagedSingle = snapshotSingleObjectiveResult(stagedResult)
      expect(Option.isSome(baselineSingle)).toBe(true)
      expect(Option.isSome(stagedSingle)).toBe(true)

      if (Option.isNone(baselineSingle) || Option.isNone(stagedSingle)) {
        return
      }

      const stagedSnapshot = yield* Study.snapshot(stagedSingle.value)
      const checkpoint = new StudySnapshot.StudySnapshot({
        ...stagedSnapshot,
        nextTrialNumber: checkpointTrials,
        trials: Arr.take(stagedSnapshot.trials, checkpointTrials),
        completedCount: checkpointTrials
      })

      yield* storage.writeSnapshot(checkpoint)
      yield* Effect.forEach(stagedSnapshot.trials, (trial) => storage.appendTrial(trial), { discard: true })

      const resumedResult = yield* Study.resumeFromStorage({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: resumedTrials,
        objective: snapshotSingleObjective
      }).pipe(
        Effect.provide(
          StudyStorage.layer(storageOptions).pipe(
            Layer.provideMerge(Layer.merge(ArtifactSink.layerFileSystem(directory), makeTestEnvelopeContextLayer))
          )
        )
      )

      const resumedSingle = snapshotSingleObjectiveResult(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(resumedSingle.value))).toBe(
        encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baselineSingle.value))
      )
      expect(encodeSnapshotValueTrace(snapshotValueTrace(resumedSingle.value))).toBe(
        encodeSnapshotValueTrace(snapshotValueTrace(baselineSingle.value))
      )

      const trialNumbers = Arr.map(Arr.fromIterable(resumedSingle.value.trials), (trial) => trial.trialNumber)

      expect(trialNumbers).toEqual(Arr.makeBy(totalTrials, (index) => index))

      const resumedSnapshot = yield* Study.snapshot(resumedSingle.value)
      expect(resumedSnapshot.nextTrialNumber).toBe(totalTrials)
      expect(resumedSnapshot.completedCount).toBe(totalTrials)
    }).pipe(Effect.provide(BunContext.layer)))
})
