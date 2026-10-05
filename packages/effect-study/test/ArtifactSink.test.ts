import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { FileSystem, Path } from "effect"
import {
  Array as Arr,
  Context,
  Deferred,
  Effect,
  Fiber,
  Ref,
  Result,
  Schema,
  SchemaGetter,
  Stream,
  String as Str
} from "effect"

import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import * as ArtifactContext from "@scenesystems/effect-study/ArtifactContext"
import * as ArtifactSink from "@scenesystems/effect-study/ArtifactSink"
import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"

class EncodePrefix extends Context.Service<EncodePrefix, string>()("effect-study/test/ArtifactSink/EncodePrefix") {}
class DecodePrefix extends Context.Service<DecodePrefix, string>()("effect-study/test/ArtifactSink/DecodePrefix") {}

const Label = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((encoded) => DecodePrefix.pipe(Effect.as(Str.toLowerCase(encoded)))),
  encode: SchemaGetter.transformEffect((label) => EncodePrefix.pipe(Effect.as(Str.toUpperCase(label))))
}))

const Artifact = Schema.Struct({ label: Label, score: Schema.FiniteFromString })

describe("ArtifactSink", () => {
  it.effect("awaits sequential fanout and keeps the allocated identity when delivery is retried", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decodeEffect(StudyArtifact.RunId)("01HZ0000000000000000000000")
      const packageVersion = yield* Schema.decodeEffect(StudyArtifact.PackageVersion)("0.1.0")
      const first = yield* ArtifactContext.make(
        new ArtifactContext.Options({ runId, packageVersion, nextSequence: 17 })
      )
      expect((yield* first.nextId).sequence).toBe(17)
      const resumed = yield* ArtifactContext.make(
        new ArtifactContext.Options({ runId, packageVersion, nextSequence: 18 })
      )
      const artifact = { id: yield* resumed.nextId, payload: "observation" }
      const schema = Schema.Struct({ id: StudyArtifact.Id, payload: Schema.String })
      const delivered = yield* Ref.make(Arr.empty<unknown>())
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const failure = new PersistenceError.Failure({ reason: "Backend", operation: "write", detail: "right rejected" })
      const left: ArtifactSink.Service = {
        emit: (schema, value) =>
          Schema.encodeEffect(schema)(value).pipe(
            Effect.mapError(PersistenceError.codec("write")),
            Effect.flatMap((encoded) => Ref.update(delivered, Arr.append(encoded)))
          )
      }
      const right: ArtifactSink.Service = {
        emit: () =>
          Deferred.succeed(entered, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.andThen(Effect.fail(failure))
          )
      }
      const sink = ArtifactSink.fanout(left, right)
      const acknowledged = yield* Deferred.make<void>()
      const pending = yield* sink.emit(schema, artifact).pipe(
        Effect.result,
        Effect.tap(() => Deferred.succeed(acknowledged, undefined)),
        Effect.forkScoped
      )
      yield* Deferred.await(entered)
      expect(yield* Ref.get(delivered)).toEqual([artifact])
      expect(yield* Deferred.isDone(acknowledged)).toBe(false)
      yield* Deferred.succeed(release, undefined)
      expect(yield* Fiber.join(pending)).toEqual(Result.fail(failure))
      expect(yield* sink.emit(schema, artifact).pipe(Effect.result)).toEqual(Result.fail(failure))
      expect(yield* Ref.get(delivered)).toEqual([artifact, artifact])
      expect((yield* resumed.nextId).sequence).toBe(19)
    }))

  it.effect("writes a transformed encoded artifact once and retains codec requirements", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-artifact-sink-" })
      const sink = yield* ArtifactSink.makeFileSystem(directory)
      yield* sink.emit(Artifact, { label: "signal", score: 2.5 }).pipe(
        Effect.provideService(EncodePrefix, "encode")
      )

      const filePath = path.join(directory, "artifacts.jsonl")
      const raw = yield* fileSystem.readFileString(filePath)
      const decoded = yield* ArtifactSink.read(Artifact, filePath).pipe(
        Stream.runCollect,
        Effect.provideService(DecodePrefix, "decode")
      )

      expect(raw).toContain("\"label\":\"SIGNAL\"")
      expect(raw).toContain("\"score\":\"2.5\"")
      expect(raw).not.toContain("\\\"label\\\"")
      expect(decoded).toEqual(Arr.of({ label: "signal", score: 2.5 }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("fans out in order and skips the right sink after a left failure", () =>
    Effect.gen(function*() {
      const delivered = yield* Ref.make(Arr.empty<string>())
      const failure = new PersistenceError.Failure({ reason: "Backend", operation: "write", detail: "unavailable" })
      const left: ArtifactSink.Service = {
        emit: () => Ref.update(delivered, Arr.append("left")).pipe(Effect.andThen(Effect.fail(failure)))
      }
      const right: ArtifactSink.Service = {
        emit: () => Ref.update(delivered, Arr.append("right"))
      }

      const outcome = yield* ArtifactSink.fanout(left, right).emit(Schema.String, "value").pipe(Effect.result)

      expect(Result.isFailure(outcome)).toBe(true)
      expect(yield* Ref.get(delivered)).toEqual(["left"])
    }))

  it.effect("reports malformed persisted artifacts with the canonical typed failure", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-artifact-corrupt-" })
      const filePath = path.join(directory, "artifacts.jsonl")
      yield* fileSystem.writeFileString(filePath, "{\"label\":")

      const outcome = yield* ArtifactSink.read(Artifact, filePath).pipe(
        Stream.runCollect,
        Effect.provideService(DecodePrefix, "decode"),
        Effect.result
      )
      const failure = yield* Effect.fromResult(Result.flip(outcome))

      expect(failure).toBeInstanceOf(PersistenceError.Failure)
      expect(failure.operation).toBe("read")
      expect(failure.line).toBe(1)
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("reports the physical line for schema-invalid JSON after blank lines", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const file = path.join(directory, "artifacts.jsonl")
      yield* fs.writeFileString(file, "7\n\n\"invalid\"\n")
      const accepted = yield* Ref.make(Arr.empty<number>())
      const outcome = yield* ArtifactSink.read(Schema.Int, file).pipe(
        Stream.runForEach((value) => Ref.update(accepted, Arr.append(value))),
        Effect.result
      )
      const failure = yield* Effect.fromResult(Result.flip(outcome))
      expect(yield* Ref.get(accepted)).toEqual([7])
      expect(failure).toMatchObject({ reason: "Codec", operation: "read", path: file, line: 3 })
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("reports the artifact journal path when encoding fails without writing a payload", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const file = path.join(directory, "measurements.jsonl")
      const sink = yield* ArtifactSink.makeFileSystem(directory, "measurements.jsonl")
      const outcome = yield* sink.emit(Schema.Int, 1.5).pipe(Effect.result)
      const failure = yield* Effect.fromResult(Result.flip(outcome))
      expect(failure).toMatchObject({ reason: "Codec", operation: "write", path: file })
      expect(yield* fs.exists(file)).toBe(false)
    }).pipe(Effect.provide(BunServices.layer)))
})
