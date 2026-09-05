import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import {
  Cause,
  Chunk,
  Data,
  Effect,
  Either,
  Exit,
  Layer,
  Number as Num,
  Option,
  Predicate,
  Ref,
  Schedule,
  Schema,
  Stream
} from "effect"

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

class TrialFinalizerDefect extends Data.TaggedClass("TrialFinalizerDefect")<{
  readonly stage: "objective-finalizer"
}> {}

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

  it.scoped("a final line torn by an interrupted append fails the read instead of being skipped", () =>
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
      const intact = yield* fileSystem.readFileString(logPath)
      yield* fileSystem.writeFileString(logPath, "{\"trialNumber\":", { flag: "a" })

      const outcome = yield* readEnvelopeLog(logPath).pipe(Stream.runCollect, Effect.either)

      expectStorageError(outcome, "read")
      if (Either.isLeft(outcome) && outcome.left instanceof ArtifactStorageError) {
        expect(outcome.left.detail).toContain(`line ${intact.split("\n").length} is not an artifact envelope`)
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("a complete JSON value that is not an envelope fails the read even as the only line", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-shape-" })
      const logPath = path.join(directory, "envelopes.jsonl")
      yield* fileSystem.writeFileString(logPath, "{}\n")

      const outcome = yield* readEnvelopeLog(logPath).pipe(Stream.runCollect, Effect.either)

      expectStorageError(outcome, "read")
      if (Either.isLeft(outcome) && outcome.left instanceof ArtifactStorageError) {
        expect(outcome.left.detail).toContain("line 1 is not an artifact envelope")
      }
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

  const failingOn = (eventTag: string, path: string): Study.EventPublisher =>
    new Study.EventPublisher({
      publish: (event) =>
        event._tag === eventTag
          ? Effect.fail(new ArtifactStorageError({ operation: "write", path, detail: `${eventTag} rejected` }))
          : Effect.void
    })

  const runWithPublisherEffect = (
    publisher: Study.EventPublisher,
    objective: Study.ObjectiveFunction<{ readonly choice: "only" }>,
    calls: Ref.Ref<number>
  ) =>
    Effect.gen(function*() {
      const kernel = yield* Study.StudyKernel
      const plan = yield* Study.optimizePlanFromOptions({
        space: SearchSpace.unsafeMake({ choice: SearchSpace.categorical(["only"]) }),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 2,
        concurrency: 1,
        retrySchedule: Schedule.recurs(3),
        objective: (config, runtime) =>
          Ref.update(calls, Num.increment).pipe(Effect.zipRight(objective(config, runtime)))
      })
      return yield* kernel.execute(
        new Study.ExecuteRequest({
          options: plan,
          seed: Option.none(),
          eventPublisher: Option.some(publisher),
          interruptionSnapshotSink: () => Effect.void
        })
      )
    }).pipe(Effect.provide(Study.StudyServicesLive))

  const runWithPublisher = (
    publisher: Study.EventPublisher,
    objective: Study.ObjectiveFunction<{ readonly choice: "only" }>,
    calls: Ref.Ref<number>
  ) => runWithPublisherEffect(publisher, objective, calls).pipe(Effect.either)

  const runWithPublisherExit = (
    publisher: Study.EventPublisher,
    objective: Study.ObjectiveFunction<{ readonly choice: "only" }>,
    calls: Ref.Ref<number>
  ) => runWithPublisherEffect(publisher, objective, calls).pipe(Effect.exit)

  it.effect("a sink that rejects TrialReported fails the study, without retrying the objective", () =>
    Effect.gen(function*() {
      const calls = yield* Ref.make(0)

      const outcome = yield* runWithPublisher(
        failingOn("TrialReported", "envelopes.jsonl"),
        (_config, runtime) => runtime.report(1, 1).pipe(Effect.as(1)),
        calls
      )

      expectStorageError(outcome, "write")
      expect(yield* Ref.get(calls)).toBe(1)
    }))

  it.effect("a rejected TrialReported preserves a subsequent objective finalizer defect", () =>
    Effect.gen(function*() {
      const calls = yield* Ref.make(0)
      const defect = new TrialFinalizerDefect({ stage: "objective-finalizer" })

      const exit = yield* runWithPublisherExit(
        failingOn("TrialReported", "envelopes.jsonl"),
        (_config, runtime) =>
          runtime.report(1, 1).pipe(
            Effect.as(1),
            Effect.ensuring(Effect.die(defect))
          ),
        calls
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(
          Chunk.some(
            Cause.failures(exit.cause),
            (failure) => failure instanceof ArtifactStorageError && failure.operation === "write"
          )
        ).toBe(true)
        expect(
          Chunk.some(
            Cause.defects(exit.cause),
            (causeDefect) => Predicate.hasProperty(causeDefect, "_tag") && causeDefect._tag === defect._tag
          )
        ).toBe(true)
      }
    }))

  it.effect("a sink that rejects StudyStopRequested fails the study, without retrying the objective", () =>
    Effect.gen(function*() {
      const calls = yield* Ref.make(0)

      const outcome = yield* runWithPublisher(
        failingOn("StudyStopRequested", "envelopes.jsonl"),
        (_config, runtime) => runtime.requestStop("done").pipe(Effect.as(1)),
        calls
      )

      expectStorageError(outcome, "write")
      expect(yield* Ref.get(calls)).toBe(1)
    }))

  it.effect("an objective that fails on its own is retried and recorded as a failed trial", () =>
    Effect.gen(function*() {
      const calls = yield* Ref.make(0)

      const outcome = yield* runWithPublisher(
        failingOn("Never", "envelopes.jsonl"),
        () => Effect.fail("objective broke"),
        calls
      )

      expect(Either.isRight(outcome)).toBe(true)
      expect(yield* Ref.get(calls)).toBe(8)
    }))
})
