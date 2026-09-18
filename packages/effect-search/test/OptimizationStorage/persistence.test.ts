import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Journal from "@scenesystems/effect-study/Journal"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Effect, Either, Match, Option, Schema, String as Str } from "effect"

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
  it.scoped("replays append-only trials at and after snapshot.nextTrialNumber", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-optimization-storage-replay-"
      })
      const options = StudyStorage.fileSystemOptions(directory)
      const storage = yield* OptimizationStorage.makeFileSystem(options)

      const result = yield* Optimization.run({
        space: yield* singleChoiceSpace(),
        sampler: Sampler.random({ seed: 101 }),
        direction: "minimize",
        trials: 4,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      })

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)
      const completed = yield* single

      const snapshot = yield* Optimization.snapshot(completed)
      const checkpoint = new OptimizationSnapshot.OptimizationSnapshot({
        ...snapshot,
        nextTrialNumber: 2,
        trials: Arr.take(snapshot.trials, 2),
        completedCount: 2
      })

      yield* storage.writeSnapshot(checkpoint)
      yield* Effect.forEach(snapshot.trials, (trial) => storage.appendTrial(trial), { discard: true })

      const replayed = yield* storage.replayTrialLog()
      expect(Arr.map(replayed, (trial) => trial.trialNumber)).toEqual(Arr.make(2, 3))
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("persists trial logs and canonical snapshots when OptimizationStorage layer is provided", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-optimization-storage-runtime-"
      })
      const options = StudyStorage.fileSystemOptions(directory)

      yield* Optimization.run({
        space: yield* singleChoiceSpace(),
        sampler: Sampler.random({ seed: 202 }),
        direction: "minimize",
        trials: 3,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      }).pipe(
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

      const snapshot = yield* persistedSnapshot
      expect(snapshot.nextTrialNumber).toBe(3)
      expect(snapshot.completedCount).toBe(3)
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("reports malformed journal records as an independent typed read failure", () =>
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
      const outcome = yield* storage.loadTrialLog().pipe(Effect.either)
      const failure = yield* Schema.decodeUnknown(Journal.Failure)(Either.getOrThrow(Either.flip(outcome)))

      expect(failure).toBeInstanceOf(Journal.Failure)
      expect(failure._tag).toBe("effect-study/JournalError")
      expect(failure.operation).toBe("read")
      expect(failure.path).toBe(journalPath)
      expect(failure.line).toBe(2)
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("reports an independent typed write failure when the journal directory disappears", () =>
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
      const result = yield* Optimization.run({
        space: yield* singleChoiceSpace(),
        sampler: Sampler.random({ seed: 303 }),
        direction: "minimize",
        trials: 1,
        objective: () => Effect.succeed(1)
      })
      const completed = yield* asSingleObjective(result)
      const trial = yield* Arr.head(Arr.fromIterable(completed.trials))

      yield* fileSystem.remove(journalDirectory, { recursive: true })
      const outcome = yield* storage.appendTrial(OptimizationSnapshot.fromTrial(trial)).pipe(Effect.either)
      const failure = yield* Schema.decodeUnknown(Journal.Failure)(Either.getOrThrow(Either.flip(outcome)))

      expect(failure).toBeInstanceOf(Journal.Failure)
      expect(failure._tag).toBe("effect-study/JournalError")
      expect(failure.operation).toBe("write")
      expect(failure.path).toBe(journalPath)
      expect(Option.isNone(Option.fromNullable(failure.line))).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))
})
