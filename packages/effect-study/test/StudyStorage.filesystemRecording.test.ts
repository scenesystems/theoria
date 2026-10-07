import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  FileSystem,
  Number as Num,
  Option,
  Path,
  pipe,
  PlatformError,
  Ref,
  Result,
  Schema,
  SchemaGetter,
  Stream,
  String as Str
} from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { conformance } from "./fixtures/recording.js"

describe("filesystem recording", () =>
  conformance(
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      return yield* StudyStorage.makeFileSystem(StudyStorage.fileSystemOptions(yield* fs.makeTempDirectoryScoped()))
    }).pipe(Effect.provide(BunServices.layer))
  ))

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

it.effect("retains physical locations for event and checkpoint payload failures across interleaved runs", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const config = StudyStorage.fileSystemOptions(yield* fs.makeTempDirectoryScoped())
    const file = path.join(config.directory, config.fileName)
    const store = yield* StudyStorage.makeFileSystem(config)
    const integers = new StudyStorage.OpenOptions({
      runId: "run",
      definitionDigest: "v1",
      eventSchema: Schema.Int,
      checkpointSchema: Schema.Int
    })
    const run = yield* store.open(integers)
    const other = yield* store.open(
      new StudyStorage.OpenOptions({
        runId: "other",
        definitionDigest: "v1",
        eventSchema: Schema.Int,
        checkpointSchema: Schema.Int
      })
    )
    yield* other.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 0, state: 3 }))
    yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: 7 }))
    yield* other.append(new StudyStorage.Append({ recordId: "other-one", expectedCursor: 0, event: 9 }))
    yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: 11 }))

    // Decode the just-appended cached payloads with an incompatible caller codec.
    // Locations must survive cache population as well as physical reconstruction.
    const strings = yield* store.open(
      new StudyStorage.OpenOptions({
        runId: "run",
        definitionDigest: "v1",
        eventSchema: Schema.String,
        checkpointSchema: Schema.String
      })
    )
    const event = yield* Effect.fromResult(Result.flip(yield* strings.read().pipe(Stream.runCollect, Effect.result)))
    const checkpoint = yield* Effect.fromResult(Result.flip(yield* strings.loadCheckpoint.pipe(Effect.result)))
    expect(event).toMatchObject({ reason: "Codec", operation: "read", path: file, line: 4 })
    expect(checkpoint).toMatchObject({ reason: "Codec", operation: "read", path: file, line: 6 })

    const original = yield* fs.readFileString(file)
    const json = Schema.encodeEffect(Schema.fromJsonString(Schema.String))
    const badEvent = yield* json("invalid-event").pipe(Effect.flatMap(json))
    const badCheckpoint = yield* json("invalid-checkpoint").pipe(Effect.flatMap(json))
    yield* fs.writeFileString(
      file,
      pipe(
        original,
        Str.replace("\"payload\":\"7\"", Str.concat("\"payload\":", badEvent)),
        Str.replace("\"payload\":\"11\"", Str.concat("\"payload\":", badCheckpoint))
      )
    )
    const reopened = yield* (yield* StudyStorage.makeFileSystem(config)).open(integers)
    const corruptEvent = yield* Effect.fromResult(
      Result.flip(yield* reopened.read().pipe(Stream.runCollect, Effect.result))
    )
    const corruptCheckpoint = yield* Effect.fromResult(Result.flip(yield* reopened.loadCheckpoint.pipe(Effect.result)))
    expect(corruptEvent).toMatchObject({ reason: "Codec", operation: "read", path: file, line: 4 })
    expect(corruptCheckpoint).toMatchObject({ reason: "Codec", operation: "read", path: file, line: 6 })
  }).pipe(Effect.provide(BunServices.layer)))

it.effect("revalidates committed, uncommitted, and partial writes after lost acknowledgment or in-flight interruption", () =>
  Effect.forEach(Arr.make("LostAck", "Uncommitted", "Committed", "Partial"), (mode) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const config = StudyStorage.fileSystemOptions(yield* fs.makeTempDirectoryScoped())
      const file = path.join(config.directory, config.fileName)
      const armed = yield* Ref.make(false)
      const reads = yield* Ref.make(0)
      const entered = yield* Deferred.make<void>()
      const observed = FileSystem.FileSystem.of({
        ...fs,
        readFileString: (file, encoding) =>
          Ref.update(reads, Num.increment).pipe(Effect.andThen(fs.readFileString(file, encoding))),
        writeFileString: (file, content, options) =>
          Effect.gen(function*() {
            if (!(yield* Ref.getAndSet(armed, false))) return yield* fs.writeFileString(file, content, options)
            if (mode !== "Uncommitted") {
              yield* fs.writeFileString(file, mode === "Partial" ? Str.slice(0, -1)(content) : content, options)
            }
            if (mode === "LostAck") {
              return yield* PlatformError.systemError({
                _tag: "Unknown",
                module: "FileSystem",
                method: "writeFileString",
                description: "acknowledgment lost after commit"
              })
            }
            yield* Deferred.succeed(entered, undefined)
            return yield* Effect.never
          })
      })
      const store = yield* StudyStorage.makeFileSystem(config).pipe(
        Effect.provideService(FileSystem.FileSystem, observed)
      )
      const request = new StudyStorage.OpenOptions({
        runId: "run",
        definitionDigest: "v1",
        eventSchema: Schema.Int,
        checkpointSchema: Schema.Int
      })
      const run = yield* store.open(request)
      const append = new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: 17 })
      yield* Ref.set(armed, true)
      if (mode === "LostAck") {
        const failure = yield* Effect.fromResult(Result.flip(yield* run.append(append).pipe(Effect.result)))
        expect(failure).toMatchObject({ reason: "Backend", operation: "write", path: file })
      } else {
        const pending = yield* run.append(append).pipe(Effect.forkChild)
        yield* Deferred.await(entered)
        yield* Fiber.interrupt(pending)
        expect(Exit.hasInterrupts(yield* Fiber.await(pending))).toBe(true)
      }
      const beforeRetry = yield* fs.readFileString(file)
      expect(yield* Ref.get(reads)).toBe(0)
      if (mode === "Partial") {
        const failure = yield* Effect.fromResult(Result.flip(yield* run.append(append).pipe(Effect.result)))
        expect(failure).toMatchObject({ reason: "Backend", operation: "read", path: file, line: 2 })
        expect(yield* Ref.get(reads)).toBe(1)
        expect(Result.isFailure(yield* StudyStorage.makeFileSystem(config).pipe(Effect.result))).toBe(true)
        expect(yield* fs.readFileString(file)).toBe(beforeRetry)
        return
      }
      expect(yield* run.append(append)).toEqual({ runId: "run", recordId: "one", cursor: 1 })
      expect(yield* Ref.get(reads)).toBe(1)
      if (mode !== "Uncommitted") expect(yield* fs.readFileString(file)).toBe(beforeRetry)
      const reopened = yield* (yield* StudyStorage.makeFileSystem(config)).open(request)
      expect(yield* reopened.append(append)).toEqual({ runId: "run", recordId: "one", cursor: 1 })
      expect(Arr.map(yield* reopened.read().pipe(Stream.runCollect), (entry) => entry.event)).toEqual([17])
      expect(yield* reopened.append(new StudyStorage.Append({ recordId: "two", expectedCursor: 1, event: 23 })))
        .toEqual({ runId: "run", recordId: "two", cursor: 2 })
    })).pipe(Effect.provide(BunServices.layer)))

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

it.effect("reopens encoded filesystem payloads with independent codec services and stable receipts", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()
    const path = yield* Path.Path
    const config = StudyStorage.fileSystemOptions(directory, "records.jsonl")
    const file = path.join(directory, "records.jsonl")
    const disk = yield* StudyStorage.makeFileSystem(config)
    const run = yield* disk.open(options)
    yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "hello" })).pipe(
      Effect.provideService(Encode, "encode")
    )
    yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: "state" })).pipe(
      Effect.provideService(Encode, "encode")
    )
    const reopened = yield* (yield* StudyStorage.makeFileSystem(config)).open(options)
    expect(
      Option.map(yield* reopened.loadCheckpoint.pipe(Effect.provideService(Decode, "decode")), (entry) => entry.state)
    ).toEqual(Option.some("state"))
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
