import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, FileSystem, Path, Result, Schema, String as Str } from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const options = new StudyStorage.OpenOptions({
  runId: "run",
  definitionDigest: "definition",
  eventSchema: Schema.Int,
  checkpointSchema: Schema.Array(Schema.Int)
})

it.effect("binds filesystem checkpoints to exact committed boundaries and rejects incompatible state", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const config = StudyStorage.fileSystemOptions(yield* fs.makeTempDirectoryScoped(), "study.jsonl")
    const file = path.join(config.directory, "study.jsonl")
    const store = yield* StudyStorage.makeFileSystem(config)
    const run = yield* store.open(options)
    yield* run.append(new StudyStorage.Append({ recordId: "first", expectedCursor: 0, event: 7 }))
    const invalid = yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 2, state: [7, 99] })).pipe(
      Effect.result
    )
    expect((yield* Effect.fromResult(Result.flip(invalid))).reason).toBe("Incompatible")
    yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: [7] }))
    yield* run.append(new StudyStorage.Append({ recordId: "second", expectedCursor: 1, event: -3 }))
    const reopenedStore = yield* StudyStorage.makeFileSystem(config)
    const reopened = yield* reopenedStore.open(options)
    expect((yield* StudyStorage.replay(reopened, Arr.empty<number>(), Arr.append)).state).toEqual([7, -3])
    const incompatible = yield* reopenedStore.open(
      new StudyStorage.OpenOptions({
        runId: options.runId,
        eventSchema: options.eventSchema,
        checkpointSchema: options.checkpointSchema,
        definitionDigest: "different"
      })
    ).pipe(Effect.result)
    expect((yield* Effect.fromResult(Result.flip(incompatible))).reason).toBe("Incompatible")
    const valid = yield* fs.readFileString(file)
    const encode = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))
    yield* Effect.forEach(
      Arr.make(
        { _tag: "Checkpoint", runId: "run", definitionDigest: "definition", through: 3, payload: "[]" },
        { _tag: "Checkpoint", runId: "run", definitionDigest: "wrong", through: 1, payload: "[]" },
        { _tag: "Event", runId: "run", definitionDigest: "definition", cursor: 4, recordId: "gap", payload: "1" },
        { _tag: "Event", runId: "run", definitionDigest: "definition", cursor: 3, recordId: "first", payload: "7" }
      ),
      (record) =>
        Effect.gen(function*() {
          yield* fs.writeFileString(file, Str.concat(valid, Str.concat(yield* encode(record), "\n")))
          const result = yield* StudyStorage.makeFileSystem(config).pipe(Effect.result)
          expect((yield* Effect.fromResult(Result.flip(result))).line).toBe(5)
        })
    )
  }).pipe(Effect.provide(BunServices.layer)))
