import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { FileSystem, Path } from "effect"
import {
  Array as Arr,
  Context,
  Effect,
  Number as Num,
  Option,
  Ref,
  Result,
  Schema,
  SchemaGetter,
  String as Str
} from "effect"

import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

class CodecPrefix extends Context.Service<CodecPrefix, string>()("effect-study/test/StudyStorage/CodecPrefix") {}
class CodecTrace extends Context.Service<CodecTrace, Ref.Ref<ReadonlyArray<string>>>()(
  "effect-study/test/StudyStorage/CodecTrace"
) {}

const Observation = Schema.Struct({
  sample: Schema.String,
  values: Schema.Array(Schema.FiniteFromString)
})

const Label = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((encoded) => CodecPrefix.pipe(Effect.as(Str.toLowerCase(encoded)))),
  encode: SchemaGetter.transformEffect((label) => CodecPrefix.pipe(Effect.as(Str.toUpperCase(label))))
}))

const Snapshot = Schema.Struct({
  label: Label,
  completed: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
})

const TracedLabel = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((encoded) =>
    CodecTrace.pipe(
      Effect.tap((trace) => Ref.update(trace, Arr.append("decode"))),
      Effect.as(Str.toLowerCase(encoded))
    )
  ),
  encode: SchemaGetter.transformEffect((label) =>
    CodecTrace.pipe(
      Effect.tap((trace) => Ref.update(trace, Arr.append("encode"))),
      Effect.as(Str.toUpperCase(label))
    )
  )
}))

describe("StudyStorage", () => {
  it.effect("keeps structured trial logs and latest snapshots isolated in memory", () =>
    Effect.gen(function*() {
      const storage = yield* StudyStorage.makeMemory
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
      const storage = yield* StudyStorage.makeMemory
      const values = Arr.range(0, 63)
      yield* Effect.forEach(values, (value) => storage.appendTrial(Schema.Finite, value), {
        concurrency: "unbounded",
        discard: true
      })

      const persisted = yield* storage.loadTrialLog(Schema.Finite)
      expect(Arr.sort(persisted, Num.Order)).toEqual(values)
    }))

  it.effect("builds independent mutable storage when the same layer is provided twice", () =>
    Effect.gen(function*() {
      const layer = StudyStorage.layerMemory
      const append = StudyStorage.appendTrial(Schema.String, "first").pipe(Effect.provide(layer))
      const load = StudyStorage.loadTrialLog(Schema.String).pipe(Effect.provide(layer))

      yield* append
      expect(yield* load).toEqual(Arr.empty())
    }))

  it.effect("schema-encodes and decodes memory records while preserving codec requirements", () =>
    Effect.gen(function*() {
      const storage = yield* StudyStorage.makeMemory
      const trace = yield* Ref.make<ReadonlyArray<string>>(Arr.empty())
      yield* storage.appendTrial(TracedLabel, "signal").pipe(Effect.provideService(CodecTrace, trace))
      const loaded = yield* storage.loadTrialLog(TracedLabel).pipe(Effect.provideService(CodecTrace, trace))

      expect(loaded).toEqual(Arr.of("signal"))
      expect(yield* Ref.get(trace)).toEqual(Arr.make("encode", "decode"))
    }))

  it.effect("round-trips transformed schemas through the explicit filesystem format", () =>
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

      expect(yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(raw)).toEqual({
        _tag: "Snapshot",
        payload: { label: "CHECKPOINT", completed: 4 }
      })
      expect(loaded).toEqual(Option.some({ label: "checkpoint", completed: 4 }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("reports malformed and torn physical records with canonical failures", () =>
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

      const outcome = yield* storage.loadTrialLog(Observation).pipe(Effect.result)
      const failure = yield* Effect.fromResult(Result.flip(outcome))

      expect(failure).toBeInstanceOf(PersistenceError.Failure)
      expect(failure.operation).toBe("read")
      expect(failure.line).toBe(2)
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("types filesystem acquisition plus distinct memory write and read codec failures", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-storage-failure-" })
      const blocker = path.join(directory, "blocker")
      yield* fileSystem.writeFileString(blocker, "file")

      const filesystem = yield* StudyStorage.makeFileSystem(
        StudyStorage.fileSystemOptions(path.join(blocker, "nested"))
      ).pipe(Effect.result)
      const memory = yield* StudyStorage.makeMemory
      const write = yield* memory.appendTrial(Schema.NonEmptyString, "").pipe(Effect.result)
      yield* memory.appendTrial(Schema.String, "")
      const read = yield* memory.loadTrialLog(Schema.NonEmptyString).pipe(Effect.result)

      expect((yield* Effect.fromResult(Result.flip(filesystem))).operation).toBe("write")
      expect((yield* Effect.fromResult(Result.flip(write))).operation).toBe("write")
      expect((yield* Effect.fromResult(Result.flip(read))).operation).toBe("read")
    }).pipe(Effect.provide(BunServices.layer)))
})
