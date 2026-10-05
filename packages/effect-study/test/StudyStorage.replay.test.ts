import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Arbitrary, Array as Arr, Effect, FileSystem, Number as Num, Path, Result, Schema, String as Str } from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const options = {
  runId: "run",
  definitionDigest: "definition",
  eventSchema: Schema.Int,
  checkpointSchema: Schema.Array(Schema.Int)
}
const numberText = Schema.encodeSync(Schema.FiniteFromString)

it.effect.prop("checkpoint plus tail equals the full ordered log despite repeated append delivery", {
  values: Arbitrary.array(Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: -100, maximum: 100 }))), {
    maxLength: 12
  }),
  split: Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 12 })))
}, ({ values, split }) =>
  Effect.gen(function*() {
    const run = yield* (yield* StudyStorage.makeMemoryRecordings).open(options)
    yield* Effect.forEach(values, (event, index) =>
      run.append({ recordId: numberText(index), expectedCursor: index, event }))
    yield* Effect.forEach(values, (event, index) =>
      run.append({ recordId: numberText(index), expectedCursor: index, event }))
    const full = yield* StudyStorage.replay(run, Arr.empty<number>(), Arr.append)
    expect(full.state).toEqual(values)
    expect(full.through).toBe(Arr.length(values))
    const through = Num.min(split, Arr.length(values))
    yield* run.writeCheckpoint({ through, state: Arr.take(values, through) })
    const tail = yield* StudyStorage.replay(run, Arr.empty<number>(), Arr.append)
    expect(tail).toEqual(full)
  }))

it.effect("binds filesystem checkpoints to exact committed boundaries and rejects incompatible state", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const file = path.join(yield* fs.makeTempDirectoryScoped(), "recordings.jsonl")
    const store = yield* StudyStorage.makeFileSystemRecordings(file)
    const run = yield* store.open(options)
    yield* run.append({ recordId: "first", expectedCursor: 0, event: 7 })
    const invalid = yield* run.writeCheckpoint({ through: 2, state: [7, 99] }).pipe(Effect.result)
    expect((yield* Effect.fromResult(Result.flip(invalid))).reason).toBe("Incompatible")
    yield* run.writeCheckpoint({ through: 1, state: [7] })
    yield* run.append({ recordId: "second", expectedCursor: 1, event: -3 })
    const reopenedStore = yield* StudyStorage.makeFileSystemRecordings(file)
    const reopened = yield* reopenedStore.open(options)
    expect((yield* StudyStorage.replay(reopened, Arr.empty<number>(), Arr.append)).state).toEqual([7, -3])
    const incompatible = yield* reopenedStore.open({ ...options, definitionDigest: "different" }).pipe(Effect.result)
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
          const result = yield* StudyStorage.makeFileSystemRecordings(file).pipe(Effect.result)
          expect((yield* Effect.fromResult(Result.flip(result))).line).toBe(5)
        })
    )
  }).pipe(Effect.provide(BunServices.layer)))
