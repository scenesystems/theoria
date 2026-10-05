import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { FileSystem, Path } from "effect"
import { Array as Arr, Effect, Match, Option, Result, Schema, String as Str, Struct } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as OptimizationStorage from "../../src/OptimizationStorage.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const singleChoiceSpace = () =>
  SearchSpace.make({
    choice: SearchSpace.categorical(Arr.of("only"))
  })

const asSingleObjective = <Config>(
  result: Optimization.Result<Config>
): Option.Option<Optimization.SingleObjectiveResult<Config>> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("OptimizationStorage", () => {
  it.effect("replays append-only trials at and after snapshot.nextTrialNumber", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-optimization-storage-replay-"
      })
      const options = StudyStorage.fileSystemOptions(directory)
      const storage = yield* OptimizationStorage.makeFileSystem(options)

      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* singleChoiceSpace(),
          sampler: Sampler.random({ seed: 101 }),
          direction: "minimize",
          trials: 4,
          concurrency: 1,
          objective: () => Effect.succeed(1)
        })
      )

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)
      const completed = yield* Effect.fromOption(single)

      const snapshot = yield* Optimization.snapshot(completed)
      const checkpoint = new OptimizationSnapshot.OptimizationSnapshot(Struct.assign(snapshot, {
        nextTrialNumber: 2,
        trials: Arr.take(snapshot.trials, 2),
        completedCount: 2
      }))

      yield* storage.writeSnapshot(checkpoint)
      yield* Effect.forEach(snapshot.trials, (trial) => storage.appendTrial(trial), { discard: true })

      const replayed = yield* storage.replayTrialLog()
      expect(Arr.map(replayed, (trial) => trial.trialNumber)).toEqual(Arr.make(2, 3))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("persists trial logs and canonical snapshots when OptimizationStorage layer is provided", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-optimization-storage-runtime-"
      })
      const options = StudyStorage.fileSystemOptions(directory)

      yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* singleChoiceSpace(),
          sampler: Sampler.random({ seed: 202 }),
          direction: "minimize",
          trials: 3,
          concurrency: 1,
          objective: () => Effect.succeed(1)
        })
      ).pipe(
        Effect.provide(OptimizationStorage.layerFileSystem(options))
      )

      const storage = yield* OptimizationStorage.makeFileSystem(options)
      const persistedTrials = yield* storage.loadTrialLog()
      const persistedSnapshot = yield* storage.loadSnapshot()
      const raw = yield* fileSystem.readFileString(path.join(directory, options.fileName))

      expect(persistedTrials).toHaveLength(3)
      expect(Option.isSome(persistedSnapshot)).toBe(true)
      expect(raw).toContain("\"_tag\":\"Trial\"")
      expect(raw).toContain("\"_tag\":\"Snapshot\"")
      expect(options.fileName).toBe("study-storage.jsonl")

      const snapshot = yield* Effect.fromOption(persistedSnapshot)
      expect(snapshot.nextTrialNumber).toBe(3)
      expect(snapshot.completedCount).toBe(3)
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("reports malformed journal records as an independent typed read failure", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-optimization-storage-corrupt-"
      })
      const options = StudyStorage.fileSystemOptions(directory, "corrupt.jsonl")
      const journalPath = path.join(directory, options.fileName)
      yield* fileSystem.writeFileString(
        journalPath,
        Str.concat(
          "{\"_tag\":\"Trial\",\"payload\":{}}\n",
          "{\"_tag\":\"Trial\""
        )
      )

      const storage = yield* OptimizationStorage.makeFileSystem(options)
      const outcome = yield* storage.loadTrialLog().pipe(Effect.result)
      const failure = yield* Schema.decodeEffect(PersistenceError.Failure)(Result.getOrThrow(Result.flip(outcome)))

      expect(failure).toBeInstanceOf(PersistenceError.Failure)
      expect(failure.reason).toBe("Codec")
      expect(failure.operation).toBe("read")
      expect(failure.path).toBe(journalPath)
      expect(failure.line).toBe(2)
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("reports an independent typed write failure when the journal directory disappears", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-optimization-storage-write-failure-"
      })
      const journalDirectory = path.join(directory, "journal")
      yield* fileSystem.makeDirectory(journalDirectory)
      const options = StudyStorage.fileSystemOptions(journalDirectory, "write-failure.jsonl")
      const journalPath = path.join(journalDirectory, options.fileName)
      const storage = yield* OptimizationStorage.makeFileSystem(options)
      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* singleChoiceSpace(),
          sampler: Sampler.random({ seed: 303 }),
          direction: "minimize",
          trials: 1,
          objective: () => Effect.succeed(1)
        })
      )
      const completed = yield* Effect.fromOption(asSingleObjective(result))
      const trial = yield* Effect.fromOption(Arr.head(Arr.fromIterable(completed.trials)))

      yield* fileSystem.remove(journalDirectory, { recursive: true })
      const outcome = yield* storage.appendTrial(OptimizationSnapshot.fromTrial(trial)).pipe(Effect.result)
      const failure = yield* Schema.decodeEffect(PersistenceError.Failure)(Result.getOrThrow(Result.flip(outcome)))

      expect(failure).toBeInstanceOf(PersistenceError.Failure)
      expect(failure.reason).toBe("Backend")
      expect(failure.operation).toBe("write")
      expect(failure.path).toBe(journalPath)
      expect(Option.isNone(Option.fromNullishOr(failure.line))).toBe(true)
    }).pipe(Effect.provide(BunServices.layer)))
})
