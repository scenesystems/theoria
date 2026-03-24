import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Schema } from "effect"

import { EnvelopeContextLive, fileSystemSink, PackageVersion, RunId } from "../../../src/contracts/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import {
  asSingleObjective,
  encodeConfigTrace,
  encodeNumericTrace,
  makeSpace,
  singleConfigTrace,
  singleObjective,
  singleValueTrace
} from "../snapshot/helpers.js"

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return EnvelopeContextLive({ packageVersion, runId, studyId: "test-study" })
}).pipe(Layer.unwrapEffect)

describe("recovery resume-from-storage", () => {
  it.scoped("restores canonical snapshot + replay tail and matches uninterrupted deterministic baseline", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-recovery-resume-storage-"
      })
      const storageOptions = Study.studyStorageOptions(directory)
      const storage = yield* Study.makeStudyStorage(storageOptions).pipe(
        Effect.provide(fileSystemSink(directory)),
        Effect.provide(makeTestEnvelopeContextLayer)
      )

      const seed = 2301
      const totalTrials = 12
      const checkpointTrials = 5
      const replayTailTrials = 2
      const resumedTrials = totalTrials - checkpointTrials - replayTailTrials

      const baselineResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: totalTrials,
        objective: singleObjective
      })
      const stagedResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: checkpointTrials + replayTailTrials,
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
      yield* Effect.forEach(stagedSnapshot.trials, (trial) => storage.appendTrial(trial), { discard: true })

      const resumedResult = yield* Study.resumeFromStorage({
        space: makeSpace(),
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

      const resumedSnapshot = yield* Study.snapshot(resumedSingle.value)
      expect(resumedSnapshot.nextTrialNumber).toBe(totalTrials)
      expect(resumedSnapshot.completedCount).toBe(totalTrials)
    }).pipe(Effect.provide(BunContext.layer)))
})
