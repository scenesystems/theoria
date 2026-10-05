import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Result, Schema, Stream } from "effect"

import * as Journal from "@scenesystems/effect-study/Journal"
import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

it.effect("distinguishes codec failures from backend failures without requiring filesystem paths", () =>
  Effect.gen(function*() {
    const storage = yield* StudyStorage.makeMemory
    const result = yield* storage.appendTrial(Schema.NonEmptyString, "").pipe(Effect.result)
    const failure = yield* Effect.fromResult(Result.flip(result))
    expect(failure.reason).toBe("Codec")
    expect(failure.operation).toBe("write")
    const backend = new PersistenceError.Failure({
      operation: "write",
      reason: "Backend",
      detail: "transaction rejected"
    })
    expect(yield* Schema.decodeEffect(PersistenceError.Failure)(backend)).toEqual(backend)
  }))

it.effect("preserves filesystem codec versus backend failures and physical diagnostics", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    const journal = yield* Journal.make(Schema.Int, directory, "values.jsonl")
    const encode = yield* journal.append(1.5).pipe(Effect.mapError(PersistenceError.fromJournal), Effect.result)
    expect((yield* Effect.fromResult(Result.flip(encode))).reason).toBe("Codec")
    yield* fs.writeFileString(journal.path, "7\n\"not-an-integer\"\n")
    const decode = yield* journal.read.pipe(
      Stream.runCollect,
      Effect.mapError(PersistenceError.fromJournal),
      Effect.result
    )
    const invalid = yield* Effect.fromResult(Result.flip(decode))
    expect(invalid.reason).toBe("Codec")
    expect(invalid.path).toBe(journal.path)
    expect(invalid.line).toBe(2)
    const backend = yield* Journal.make(Schema.Int, path.join(journal.path, "blocked"), "values.jsonl").pipe(
      Effect.mapError(PersistenceError.fromJournal),
      Effect.result
    )
    expect((yield* Effect.fromResult(Result.flip(backend))).reason).toBe("Backend")
  }).pipe(Effect.provide(BunServices.layer)))
