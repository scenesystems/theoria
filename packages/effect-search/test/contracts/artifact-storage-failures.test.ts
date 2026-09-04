import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Cause, Chunk, Effect, Either, Exit, Layer, Schema, Stream } from "effect"

import {
  ArtifactSink,
  EnvelopeContextLive,
  fileSystemSink,
  PackageVersion,
  readEnvelopeLog,
  RunId
} from "../../src/contracts/index.js"
import { ArtifactStorageError } from "../../src/Errors/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return EnvelopeContextLive({ packageVersion, runId, studyId: "test-study" })
}).pipe(Layer.unwrapEffect)

const expectStorageError = (
  outcome: Either.Either<unknown, unknown>,
  operation: ArtifactStorageError["operation"]
): void => {
  expect(Either.isLeft(outcome)).toBe(true)
  if (Either.isLeft(outcome)) {
    expect(outcome.left).toBeInstanceOf(ArtifactStorageError)
    if (outcome.left instanceof ArtifactStorageError) {
      expect(outcome.left.operation).toBe(operation)
    }
  }
}

describe("contracts/artifact storage failures", () => {
  it.scoped("a log that does not exist yet reads as empty", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-missing-" })

      const envelopes = yield* readEnvelopeLog(path.join(directory, "envelopes.jsonl")).pipe(Stream.runCollect)

      expect(Chunk.isEmpty(envelopes)).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a log that exists but cannot be read fails with a typed read error", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-unreadable-" })

      const outcome = yield* readEnvelopeLog(directory).pipe(Stream.runCollect, Effect.either)

      expectStorageError(outcome, "read")
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a torn final line is crash residue and the envelopes before it still read", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-torn-" })
      const logPath = path.join(directory, "envelopes.jsonl")

      yield* Study.optimize({
        space: SearchSpace.unsafeMake({ choice: SearchSpace.categorical(["only"]) }),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 2,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      }).pipe(
        Effect.provide(
          Study.StudyStorageLive(Study.studyStorageOptions(directory)).pipe(
            Layer.provideMerge(Layer.merge(fileSystemSink(directory), makeTestEnvelopeContextLayer))
          )
        )
      )
      const intact = yield* readEnvelopeLog(logPath).pipe(Stream.runCollect)
      yield* fileSystem.writeFileString(logPath, "{\"trialNumber\":", { flag: "a" })

      const withTornTail = yield* readEnvelopeLog(logPath).pipe(Stream.runCollect)

      expect(Chunk.size(withTornTail)).toBe(Chunk.size(intact))
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("an undecodable line before the end is corruption and fails with the line number", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-corrupt-" })
      const logPath = path.join(directory, "envelopes.jsonl")

      yield* Study.optimize({
        space: SearchSpace.unsafeMake({ choice: SearchSpace.categorical(["only"]) }),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 1,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      }).pipe(
        Effect.provide(
          Study.StudyStorageLive(Study.studyStorageOptions(directory)).pipe(
            Layer.provideMerge(Layer.merge(fileSystemSink(directory), makeTestEnvelopeContextLayer))
          )
        )
      )
      const intact = yield* fileSystem.readFileString(logPath)
      yield* fileSystem.writeFileString(logPath, `${intact}not an envelope\n\n${intact}`)

      const outcome = yield* readEnvelopeLog(logPath).pipe(Stream.runCollect, Effect.either)

      expectStorageError(outcome, "read")
      if (Either.isLeft(outcome) && outcome.left instanceof ArtifactStorageError) {
        const corruptLineNumber = intact.split("\n").length
        expect(outcome.left.detail).toContain(`line ${corruptLineNumber} is not an artifact envelope`)
        expect(outcome.left.path).toBe(logPath)
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a sink whose log path is a directory fails emit with a typed write error", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-unwritable-" })
      yield* fileSystem.makeDirectory(path.join(directory, "envelopes.jsonl"))

      const outcome = yield* Study.optimize({
        space: SearchSpace.unsafeMake({ choice: SearchSpace.categorical(["only"]) }),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 2,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      }).pipe(
        Effect.provide(
          Study.StudyStorageLive(Study.studyStorageOptions(directory)).pipe(
            Layer.provideMerge(Layer.merge(fileSystemSink(directory), makeTestEnvelopeContextLayer))
          )
        ),
        Effect.either
      )

      expectStorageError(outcome, "write")
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a failing checkpoint follows the study's own failure in the exit instead of replacing it", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-checkpoint-" })
      yield* fileSystem.makeDirectory(path.join(directory, "envelopes.jsonl"))

      const exit = yield* Study.optimize({
        space: SearchSpace.unsafeMake({ choice: SearchSpace.categorical(["only"]) }),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 2,
        concurrency: 1,
        objective: () => Effect.succeed(1)
      }).pipe(
        Effect.provide(
          Study.StudyStorageLive(Study.studyStorageOptions(directory)).pipe(
            Layer.provideMerge(Layer.merge(fileSystemSink(directory), makeTestEnvelopeContextLayer))
          )
        ),
        Effect.exit
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(Cause.isDie(exit.cause)).toBe(false)
        expect(Cause.isInterrupted(exit.cause)).toBe(false)
        const failures = Chunk.toReadonlyArray(Cause.failures(exit.cause))
        expect(failures.every((failure) => failure instanceof ArtifactStorageError)).toBe(true)
        expect(failures.length).toBeGreaterThan(1)
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a sink directory that cannot be created fails the layer with a typed write error", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-blocked-" })
      const blocker = path.join(directory, "blocker")
      yield* fileSystem.writeFileString(blocker, "not a directory")

      const outcome = yield* ArtifactSink.pipe(
        Effect.provide(fileSystemSink(path.join(blocker, "nested"))),
        Effect.either
      )

      expectStorageError(outcome, "write")
    }).pipe(Effect.provide(BunContext.layer)))
})
