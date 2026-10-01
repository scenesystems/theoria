import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Context, Effect, Either, Number as Num, Option, Ref, Schema, String as Str } from "effect"

import * as Journal from "@scenesystems/effect-study/Journal"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

class CodecPrefix extends Context.Tag("effect-study/test/StudyStorage/CodecPrefix")<CodecPrefix, string>() {}
class CodecTrace extends Context.Tag("effect-study/test/StudyStorage/CodecTrace")<
  CodecTrace,
  Ref.Ref<Schema.Schema.Type<Schema.Array$<typeof Schema.String>>>
>() {}

const Observation = Schema.Struct({
  sample: Schema.String,
  values: Schema.Array(Schema.NumberFromString)
})

const Label = Schema.transformOrFail(Schema.String, Schema.String, {
  strict: true,
  decode: (encoded) => CodecPrefix.pipe(Effect.as(Str.toLowerCase(encoded))),
  encode: (label) => CodecPrefix.pipe(Effect.as(Str.toUpperCase(label)))
})

const Snapshot = Schema.Struct({ label: Label, completed: Schema.NonNegativeInt })

const TracedLabel = Schema.transformOrFail(Schema.String, Schema.String, {
  strict: true,
  decode: (encoded) =>
    CodecTrace.pipe(
      Effect.tap((trace) => Ref.update(trace, Arr.append("decode"))),
      Effect.as(Str.toLowerCase(encoded))
    ),
  encode: (label) =>
    CodecTrace.pipe(
      Effect.tap((trace) => Ref.update(trace, Arr.append("encode"))),
      Effect.as(Str.toUpperCase(label))
    )
})

describe("StudyStorage", () => {
  it.effect("keeps structured trial logs and latest snapshots isolated in memory", () =>
    Effect.gen(function*() {
      const storage = yield* StudyStorage.makeMemory()
      yield* storage.appendTrial(Observation, { sample: "first", values: Arr.make(1.5, 2.5) })
      yield* storage.writeSnapshot(Snapshot, { label: "early", completed: 1 }).pipe(
        Effect.provideService(CodecPrefix, "codec")
      )
      yield* storage.appendTrial(Observation, { sample: "second", values: Arr.of(3.5) })
      yield* storage.writeSnapshot(Snapshot, { label: "latest", completed: 2 }).pipe(
        Effect.provideService(CodecPrefix, "codec")
      )

      const trials = yield* storage.loadTrialLog(Observation)
      const snapshot = yield* storage.loadSnapshot(Snapshot).pipe(Effect.provideService(CodecPrefix, "codec"))

      expect(trials).toEqual(Arr.make(
        { sample: "first", values: Arr.make(1.5, 2.5) },
        { sample: "second", values: Arr.of(3.5) }
      ))
      expect(snapshot).toEqual(Option.some({ label: "latest", completed: 2 }))
    }))

  it.effect("serializes concurrent in-memory appends without losing records", () =>
    Effect.gen(function*() {
      const storage = yield* StudyStorage.makeMemory()
      const values = Arr.range(0, 63)
      yield* Effect.forEach(values, (value) => storage.appendTrial(Schema.Number, value), {
        concurrency: "unbounded",
        discard: true
      })

      const persisted = yield* storage.loadTrialLog(Schema.Number)
      expect(Arr.sort(persisted, Num.Order)).toEqual(values)
    }))

  it.effect("schema-encodes and decodes memory records while preserving codec requirements", () =>
    Effect.gen(function*() {
      const storage = yield* StudyStorage.makeMemory()
      const trace = yield* Ref.make<Schema.Schema.Type<Schema.Array$<typeof Schema.String>>>(Arr.empty())
      yield* storage.appendTrial(TracedLabel, "signal").pipe(Effect.provideService(CodecTrace, trace))
      const loaded = yield* storage.loadTrialLog(TracedLabel).pipe(Effect.provideService(CodecTrace, trace))

      expect(loaded).toEqual(Arr.of("signal"))
      expect(yield* Ref.get(trace)).toEqual(Arr.make("encode", "decode"))
    }))

  it.scoped("round-trips transformed schemas through the explicit filesystem format", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-storage-" })
      const config = StudyStorage.fileSystemOptions(directory)
      const storage = yield* StudyStorage.makeFileSystem(config)
      yield* storage.writeSnapshot(Snapshot, { label: "checkpoint", completed: 4 }).pipe(
        Effect.provideService(CodecPrefix, "codec")
      )

      const raw = yield* fileSystem.readFileString(path.join(directory, config.fileName))
      const loaded = yield* storage.loadSnapshot(Snapshot).pipe(Effect.provideService(CodecPrefix, "codec"))

      expect(yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw)).toEqual({
        _tag: "Snapshot",
        payload: { label: "CHECKPOINT", completed: 4 }
      })
      expect(loaded).toEqual(Option.some({ label: "checkpoint", completed: 4 }))
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("reports malformed and torn physical records with canonical failures", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-storage-torn-" })
      const config = StudyStorage.fileSystemOptions(directory)
      const filePath = path.join(directory, config.fileName)
      yield* fileSystem.writeFileString(
        filePath,
        "{\"_tag\":\"Trial\",\"payload\":{\"sample\":\"ok\",\"values\":[\"1\"]}}\n{\"_tag\":"
      )
      const storage = yield* StudyStorage.makeFileSystem(config)

      const outcome = yield* storage.loadTrialLog(Observation).pipe(Effect.either)
      const failure = yield* Either.getLeft(outcome)

      expect(failure).toBeInstanceOf(Journal.Failure)
      expect(failure.operation).toBe("read")
      expect(failure.line).toBe(2)
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("types filesystem acquisition plus distinct memory write and read codec failures", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-storage-failure-" })
      const blocker = path.join(directory, "blocker")
      yield* fileSystem.writeFileString(blocker, "file")

      const filesystem = yield* StudyStorage.makeFileSystem(
        StudyStorage.fileSystemOptions(path.join(blocker, "nested"))
      ).pipe(Effect.either)
      const memory = yield* StudyStorage.makeMemory()
      const write = yield* memory.appendTrial(Schema.NonEmptyString, "").pipe(Effect.either)
      yield* memory.appendTrial(Schema.String, "")
      const read = yield* memory.loadTrialLog(Schema.NonEmptyString).pipe(Effect.either)

      expect((yield* Either.getLeft(filesystem)).operation).toBe("write")
      expect((yield* Either.getLeft(write)).operation).toBe("write")
      expect((yield* Either.getLeft(read)).operation).toBe("read")
    }).pipe(Effect.provide(BunContext.layer)))
})
