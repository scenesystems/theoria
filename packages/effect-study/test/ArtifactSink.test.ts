import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { FileSystem, Path } from "effect"
import { Array as Arr, Context, Effect, Ref, Result, Schema, SchemaGetter, Stream, String as Str } from "effect"

import * as ArtifactSink from "@scenesystems/effect-study/ArtifactSink"
import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"

class CodecPrefix extends Context.Service<CodecPrefix, string>()("effect-study/test/ArtifactSink/CodecPrefix") {}

const Label = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((encoded) => CodecPrefix.pipe(Effect.as(Str.toLowerCase(encoded)))),
  encode: SchemaGetter.transformEffect((label) => CodecPrefix.pipe(Effect.as(Str.toUpperCase(label))))
}))

const Artifact = Schema.Struct({ label: Label, score: Schema.FiniteFromString })

describe("ArtifactSink", () => {
  it.effect("writes a transformed encoded artifact once and retains codec requirements", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-artifact-sink-" })
      const sink = yield* ArtifactSink.makeFileSystem(directory)
      yield* sink.emit(Artifact, { label: "signal", score: 2.5 }).pipe(
        Effect.provideService(CodecPrefix, "codec")
      )

      const filePath = path.join(directory, "artifacts.jsonl")
      const raw = yield* fileSystem.readFileString(filePath)
      const decoded = yield* ArtifactSink.read(Artifact, filePath).pipe(
        Stream.runCollect,
        Effect.provideService(CodecPrefix, "codec")
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
        Effect.provideService(CodecPrefix, "codec"),
        Effect.result
      )
      const failure = yield* Effect.fromResult(Result.flip(outcome))

      expect(failure).toBeInstanceOf(PersistenceError.Failure)
      expect(failure.operation).toBe("read")
      expect(failure.line).toBe(1)
    }).pipe(Effect.provide(BunServices.layer)))
})
