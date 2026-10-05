import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Context,
  Effect,
  FileSystem,
  Option,
  Path,
  Result,
  Schema,
  SchemaGetter,
  Stream,
  String as Str
} from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

class Encode extends Context.Service<Encode, string>()("effect-study/test/recording/Encode") {}
class Decode extends Context.Service<Decode, string>()("effect-study/test/recording/Decode") {}
const Label = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((value) => Decode.pipe(Effect.as(Str.toLowerCase(value)))),
  encode: SchemaGetter.transformEffect((value) => Encode.pipe(Effect.as(Str.toUpperCase(value))))
}))
const options = { runId: "run", definitionDigest: "v1", eventSchema: Label, checkpointSchema: Label }

it.effect("round-trips independent codec services and stable receipts through memory and reopened files", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()
    const path = yield* Path.Path
    const file = path.join(directory, "records.jsonl")
    const memory = yield* StudyStorage.makeMemoryRecordings
    const disk = yield* StudyStorage.makeFileSystemRecordings(file)
    yield* Effect.forEach(Arr.make(memory, disk), (store) =>
      Effect.gen(function*() {
        const run = yield* store.open(options)
        yield* run.append({ recordId: "one", expectedCursor: 0, event: "hello" }).pipe(
          Effect.provideService(Encode, "encode")
        )
        yield* run.writeCheckpoint({ through: 1, state: "state" }).pipe(Effect.provideService(Encode, "encode"))
        expect(Arr.map(yield* run.read().pipe(Stream.runCollect, Effect.provideService(Decode, "decode")), (entry) =>
          entry.event)).toEqual(["hello"])
        expect(Option.map(yield* run.loadCheckpoint.pipe(Effect.provideService(Decode, "decode")), (entry) =>
          entry.state)).toEqual(Option.some("state"))
      }))
    const reopened = yield* (yield* StudyStorage.makeFileSystemRecordings(file)).open(options)
    expect(
      yield* reopened.append({ recordId: "one", expectedCursor: 0, event: "hello" }).pipe(
        Effect.provideService(Encode, "encode")
      )
    ).toEqual({ runId: "run", recordId: "one", cursor: 1 })
    expect(
      Arr.map(
        yield* reopened.read().pipe(Stream.runCollect, Effect.provideService(Decode, "decode")),
        (entry) => entry.event
      )
    ).toEqual(["hello"])
    expect(yield* fs.readFileString(file)).toContain("HELLO")
  }).pipe(Effect.provide(BunServices.layer)))

it.effect("rejects malformed middle records, torn tails, and parseable but uncommitted tails without modifying the file", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()
    const path = yield* Path.Path
    const file = path.join(directory, "records.jsonl")
    const store = yield* StudyStorage.makeFileSystemRecordings(file)
    yield* store.open(options)
    const header = yield* fs.readFileString(file)
    yield* Effect.forEach(
      Arr.make(
        Str.concat(header, "{bad}\n{}\n"),
        Str.concat(header, "{\"_tag\":"),
        Str.concat(header, "{}")
      ),
      (damaged) =>
        Effect.gen(function*() {
          yield* fs.writeFileString(file, damaged)
          const result = yield* StudyStorage.makeFileSystemRecordings(file).pipe(Effect.result)
          const failure = yield* Effect.fromResult(Result.flip(result))
          expect(failure.reason).toBe("Backend")
          expect(failure.path).toBe(file)
          expect(failure.line).toBe(2)
          const open = yield* store.open(options).pipe(Effect.result)
          expect(Result.isFailure(open)).toBe(true)
          expect(yield* fs.readFileString(file)).toBe(damaged)
        })
    )
  }).pipe(Effect.provide(BunServices.layer)))
