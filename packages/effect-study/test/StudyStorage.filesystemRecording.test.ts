import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Context,
  Effect,
  FileSystem,
  Number as Num,
  Option,
  Path,
  Ref,
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
const options = new StudyStorage.OpenOptions({
  runId: "run",
  definitionDigest: "v1",
  eventSchema: Label,
  checkpointSchema: Label
})
const numberText = Schema.encodeSync(Schema.FiniteFromString)

it.effect("indexes a recording once and does not reread acknowledged prefixes on every append", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const reads = yield* Ref.make(Arr.empty<string>())
    const observed = FileSystem.FileSystem.of({
      ...fs,
      readFileString: (path, encoding) =>
        Ref.update(reads, Arr.append(path)).pipe(Effect.andThen(fs.readFileString(path, encoding)))
    })
    const config = StudyStorage.fileSystemOptions(yield* fs.makeTempDirectoryScoped())
    const store = yield* StudyStorage.makeFileSystem(config).pipe(
      Effect.provideService(FileSystem.FileSystem, observed)
    )
    const run = yield* store.open(options)
    yield* Effect.forEach(
      Arr.range(0, 31),
      (expectedCursor) =>
        run.append(new StudyStorage.Append({ recordId: numberText(expectedCursor), expectedCursor, event: "value" }))
          .pipe(
            Effect.provideService(Encode, "encode")
          )
    )
    expect(yield* Ref.get(reads)).toEqual([])
    const reopened = yield* StudyStorage.makeFileSystem(config).pipe(
      Effect.provideService(FileSystem.FileSystem, observed)
    )
    const restored = yield* reopened.open(options)
    expect(yield* restored.read().pipe(Stream.runCollect, Effect.provideService(Decode, "decode"))).toHaveLength(32)
    expect(yield* Ref.get(reads)).toHaveLength(1)
  }).pipe(Effect.provide(BunServices.layer)))

it.effect("round-trips independent codec services and stable receipts through memory and reopened files", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()
    const path = yield* Path.Path
    const config = StudyStorage.fileSystemOptions(directory, "records.jsonl")
    const file = path.join(directory, "records.jsonl")
    const memory = yield* StudyStorage.makeMemory
    const disk = yield* StudyStorage.makeFileSystem(config)
    yield* Effect.forEach(Arr.make(memory, disk), (store) =>
      Effect.gen(function*() {
        const run = yield* store.open(options)
        yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "hello" })).pipe(
          Effect.provideService(Encode, "encode")
        )
        yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: "state" })).pipe(
          Effect.provideService(Encode, "encode")
        )
        expect(Arr.map(yield* run.read().pipe(Stream.runCollect, Effect.provideService(Decode, "decode")), (entry) =>
          entry.event)).toEqual(["hello"])
        expect(Option.map(yield* run.loadCheckpoint.pipe(Effect.provideService(Decode, "decode")), (entry) =>
          entry.state)).toEqual(Option.some("state"))
      }))
    const reopened = yield* (yield* StudyStorage.makeFileSystem(config)).open(options)
    expect(
      yield* reopened.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "hello" })).pipe(
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
    const config = StudyStorage.fileSystemOptions(directory, "records.jsonl")
    const file = path.join(directory, "records.jsonl")
    const store = yield* StudyStorage.makeFileSystem(config)
    const run = yield* store.open(options)
    const header = yield* fs.readFileString(file)
    yield* Effect.forEach(
      Arr.make(
        Str.concat(header, "{bad}\n{}\n"),
        Str.concat(header, "{\"_tag\":"),
        Str.concat(
          header,
          "{\"_tag\":\"Event\",\"runId\":\"run\",\"definitionDigest\":\"v1\",\"recordId\":\"one\",\"cursor\":1,\"payload\":\"\\\"HELLO\\\"\"}"
        )
      ),
      (damaged, index) =>
        Effect.gen(function*() {
          yield* fs.writeFileString(file, damaged)
          const result = yield* StudyStorage.makeFileSystem(config).pipe(Effect.result)
          const failure = yield* Effect.fromResult(Result.flip(result))
          expect(failure.reason).toBe(Num.Equivalence(index, 0) ? "Codec" : "Backend")
          expect(failure.path).toBe(file)
          expect(failure.line).toBe(2)
          const open = yield* store.open(options).pipe(Effect.result)
          expect(Result.isFailure(open)).toBe(true)
          const append = yield* run.append(
            new StudyStorage.Append({ recordId: "two", expectedCursor: 0, event: "later" })
          ).pipe(
            Effect.provideService(Encode, "encode"),
            Effect.result
          )
          expect(Result.isFailure(append)).toBe(true)
          expect(yield* fs.readFileString(file)).toBe(damaged)
        })
    )
  }).pipe(Effect.provide(BunServices.layer)))
