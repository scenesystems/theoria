import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Match, Option, Schema } from "effect"

import { EnvelopeContextLive, fileSystemSink, PackageVersion, RunId } from "../../src/contracts/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return EnvelopeContextLive({ packageVersion, runId, studyId: "test-study" })
}).pipe(Layer.unwrapEffect)

const singleChoiceSpace = () =>
  SearchSpace.unsafeMake({
    choice: SearchSpace.categorical(["only"])
  })

const asSingleObjective = <Config>(
  result: Study.StudyResult<Config>
): Option.Option<Study.SingleObjectiveResult<Config>> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("StudyStorage", () => {
  it.scoped("replays append-only trials at and after snapshot.nextTrialNumber", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-study-storage-replay-"
      })
      const options = Study.studyStorageOptions(directory)
      const storage = yield* Study.StudyStorage.allocate(options).pipe(
        Effect.provide(fileSystemSink(directory)),
        Effect.provide(makeTestEnvelopeContextLayer)
      )

      const result = yield* Study.optimize({
        space: singleChoiceSpace(),
        sampler: Sampler.random({ seed: 101 }),
        direction: "minimize",
        trials: 4,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      })

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const checkpoint = new Study.StudySnapshot({
        ...snapshot,
        nextTrialNumber: 2,
        trials: Arr.take(snapshot.trials, 2),
        completedCount: 2
      })

      yield* storage.writeSnapshot(checkpoint)
      yield* Effect.forEach(snapshot.trials, (trial) => storage.appendTrial(trial), { discard: true })

      const replayed = yield* storage.replayTrialLog()
      expect(Arr.map(replayed, (trial) => trial.trialNumber)).toEqual([2, 3])
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("persists trial logs and canonical snapshots when StudyStorage layer is provided", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-study-storage-runtime-"
      })
      const options = Study.studyStorageOptions(directory)

      yield* Study.optimize({
        space: singleChoiceSpace(),
        sampler: Sampler.random({ seed: 202 }),
        direction: "minimize",
        trials: 3,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      }).pipe(
        Effect.provide(Study.StudyStorageLive(options)),
        Effect.provide(fileSystemSink(directory)),
        Effect.provide(makeTestEnvelopeContextLayer)
      )

      const storage = yield* Study.StudyStorage.allocate(options).pipe(
        Effect.provide(fileSystemSink(directory)),
        Effect.provide(makeTestEnvelopeContextLayer)
      )
      const persistedTrials = yield* storage.loadTrialLog()
      const persistedSnapshot = yield* storage.loadSnapshot()
      const tempSnapshotPath = path.join(directory, `${options.envelopeFileName}.tmp`)

      expect(persistedTrials).toHaveLength(3)
      expect(Option.isSome(persistedSnapshot)).toBe(true)
      expect(yield* fileSystem.exists(tempSnapshotPath)).toBe(false)

      if (Option.isSome(persistedSnapshot)) {
        expect(persistedSnapshot.value.nextTrialNumber).toBe(3)
        expect(persistedSnapshot.value.completedCount).toBe(3)
      }
    }).pipe(Effect.provide(BunContext.layer)))
})
