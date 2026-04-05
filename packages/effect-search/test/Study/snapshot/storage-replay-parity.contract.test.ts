import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Schema } from "effect"

import { EnvelopeContextLive, fileSystemSink, PackageVersion, RunId } from "../../../src/contracts/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import { asSingleObjective, encodeConfigTrace, makeSpace, singleConfigTrace, singleObjective } from "./helpers.js"

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return EnvelopeContextLive({ packageVersion, runId, studyId: "effect-search-storage-replay" })
}).pipe(Layer.unwrapEffect)

const tpeOptions = {
  seed: 1701,
  nStartupTrials: 4,
  nEiCandidates: 16
}

describe("Study snapshot storage replay parity", () => {
  it.scoped("replays storage tails with the same deterministic config trace as an uninterrupted TPE run", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-storage-replay-parity-"
      })
      const storageOptions = Study.studyStorageOptions(directory)
      const storage = yield* Study.makeStudyStorage(storageOptions).pipe(
        Effect.provide(fileSystemSink(directory)),
        Effect.provide(makeTestEnvelopeContextLayer)
      )

      const totalTrials = 10
      const checkpointTrials = 6
      const replayTailTrials = 2
      const resumedTrials = totalTrials - checkpointTrials - replayTailTrials

      const baselineResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(tpeOptions),
        direction: "minimize",
        trials: totalTrials,
        objective: singleObjective
      })
      const stagedResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(tpeOptions),
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
        sampler: Sampler.tpe(tpeOptions),
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
    }).pipe(Effect.provide(BunContext.layer)))
})
