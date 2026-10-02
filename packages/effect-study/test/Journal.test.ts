import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { FileSystem, Path } from "effect"
import {
  Array as Arr,
  Context,
  Effect,
  Number as Num,
  Ref,
  Result,
  Schema,
  SchemaGetter,
  Stream,
  String as Str
} from "effect"

import * as Journal from "@scenesystems/effect-study/Journal"

class CodecPrefix extends Context.Service<CodecPrefix, string>()("effect-study/test/CodecPrefix") {}

const Name = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((encoded) => CodecPrefix.pipe(Effect.as(Str.toLowerCase(encoded)))),
  encode: SchemaGetter.transformEffect((name) => CodecPrefix.pipe(Effect.as(Str.toUpperCase(name))))
}))

const Entry = Schema.Struct({ name: Name, score: Schema.FiniteFromString })

describe("Journal", () => {
  it.effect("round-trips a transformed schema and retains its requirements", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-journal-codec-" })
      const journal = yield* Journal.make(Entry, directory, "records.jsonl")
      yield* journal.append({ name: "alpha", score: 1.5 }).pipe(Effect.provideService(CodecPrefix, "prefix"))
      const raw = yield* fileSystem.readFileString(journal.path)
      const encoded = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
        name: Schema.String,
        score: Schema.String
      })))(raw)
      const records = yield* journal.read.pipe(
        Stream.runCollect,
        Effect.provideService(CodecPrefix, "prefix")
      )

      expect(encoded).toEqual({ name: "ALPHA", score: "1.5" })
      expect(records).toEqual(Arr.of({ name: "alpha", score: 1.5 }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("treats a missing log as empty and ignores blank lines", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-journal-missing-" })
      const filePath = path.join(directory, "records.jsonl")
      const missing = yield* Journal.read(Entry, filePath).pipe(
        Stream.runCollect,
        Effect.provideService(CodecPrefix, "prefix")
      )
      yield* fileSystem.writeFileString(filePath, "\n  \n{\"name\":\"BETA\",\"score\":\"2\"}\n\t\n")
      const present = yield* Journal.read(Entry, filePath).pipe(
        Stream.runCollect,
        Effect.provideService(CodecPrefix, "prefix")
      )

      expect(Arr.isReadonlyArrayEmpty(missing)).toBe(true)
      expect(present).toEqual(Arr.of({ name: "beta", score: 2 }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("reports the physical line containing malformed or torn JSON", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-journal-torn-" })
      const filePath = path.join(directory, "records.jsonl")
      yield* fileSystem.writeFileString(filePath, "\n{\"name\":\"GOOD\",\"score\":\"1\"}\n\n{\"name\":")

      const outcome = yield* Journal.read(Entry, filePath).pipe(
        Stream.runCollect,
        Effect.provideService(CodecPrefix, "prefix"),
        Effect.result
      )

      expect(Result.isFailure(outcome)).toBe(true)
      const error = yield* Effect.fromResult(Result.flip(outcome))
      expect(error).toBeInstanceOf(Journal.Failure)
      expect(error.operation).toBe("read")
      expect(error.line).toBe(4)
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("serializes concurrent appends within one journal", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-journal-concurrent-" })
      const active = yield* Ref.make(0)
      const maximum = yield* Ref.make(0)
      const SerializedNumber = Schema.Finite.pipe(Schema.decode({
        decode: SchemaGetter.passthrough(),
        encode: SchemaGetter.transformEffect((value) =>
          Effect.acquireUseRelease(
            Ref.updateAndGet(active, Num.increment),
            (count) => Ref.update(maximum, Num.max(count)).pipe(Effect.andThen(Effect.yieldNow), Effect.as(value)),
            () => Ref.update(active, Num.decrement)
          )
        )
      }))
      const journal = yield* Journal.make(SerializedNumber, directory, "records.jsonl")
      const values = Arr.range(1, 40)

      yield* Effect.forEach(values, journal.append, { concurrency: "unbounded", discard: true })
      const persisted = yield* journal.read.pipe(Stream.runCollect)

      expect(yield* Ref.get(maximum)).toBe(1)
      expect(Arr.sort(persisted, Num.Order)).toEqual(values)
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("types read and write failures", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-journal-failure-" })
      const blocker = path.join(directory, "blocker")
      yield* fileSystem.writeFileString(blocker, "file")
      const write = yield* Journal.make(Entry, blocker, "records.jsonl").pipe(Effect.result)
      const read = yield* Journal.read(Entry, directory).pipe(
        Stream.runCollect,
        Effect.provideService(CodecPrefix, "prefix"),
        Effect.result
      )

      const writeError = yield* Effect.fromResult(Result.flip(write))
      const readError = yield* Effect.fromResult(Result.flip(read))
      expect(writeError.operation).toBe("write")
      expect(readError.operation).toBe("read")
    }).pipe(Effect.provide(BunServices.layer)))
})
