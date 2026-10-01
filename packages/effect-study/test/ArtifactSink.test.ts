import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Context, Effect, Either, Ref, Schema, Stream, String as Str } from "effect"

import * as ArtifactSink from "@scenesystems/effect-study/ArtifactSink"
import * as Journal from "@scenesystems/effect-study/Journal"

class CodecPrefix extends Context.Tag("effect-study/test/ArtifactSink/CodecPrefix")<CodecPrefix, string>() {}

const Label = Schema.transformOrFail(Schema.String, Schema.String, {
  strict: true,
  decode: (encoded) => CodecPrefix.pipe(Effect.as(Str.toLowerCase(encoded))),
  encode: (label) => CodecPrefix.pipe(Effect.as(Str.toUpperCase(label)))
})

const Artifact = Schema.Struct({ label: Label, score: Schema.NumberFromString })

describe("ArtifactSink", () => {
  it.scoped("writes a transformed encoded artifact once and retains codec requirements", () =>
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
      expect(Chunk.toReadonlyArray(decoded)).toEqual(Arr.of({ label: "signal", score: 2.5 }))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("fans out in order and skips the right sink after a left failure", () =>
    Effect.gen(function*() {
      const delivered = yield* Ref.make(Arr.empty<string>())
      const failure = new Journal.Failure({ operation: "write", path: "left", detail: "unavailable" })
      const left: ArtifactSink.Service = {
        emit: () => Ref.update(delivered, Arr.append("left")).pipe(Effect.zipRight(Effect.fail(failure)))
      }
      const right: ArtifactSink.Service = {
        emit: () => Ref.update(delivered, Arr.append("right"))
      }

      const outcome = yield* ArtifactSink.fanout(left, right).emit(Schema.String, "value").pipe(Effect.either)

      expect(Either.isLeft(outcome)).toBe(true)
      expect(yield* Ref.get(delivered)).toEqual(["left"])
    }))

  it.scoped("reports malformed persisted artifacts with the canonical typed failure", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-artifact-corrupt-" })
      const filePath = path.join(directory, "artifacts.jsonl")
      yield* fileSystem.writeFileString(filePath, "{\"label\":")

      const outcome = yield* ArtifactSink.read(Artifact, filePath).pipe(
        Stream.runCollect,
        Effect.provideService(CodecPrefix, "codec"),
        Effect.either
      )
      const failure = yield* Either.getLeft(outcome)

      expect(failure).toBeInstanceOf(Journal.Failure)
      expect(failure.operation).toBe("read")
      expect(failure.line).toBe(1)
    }).pipe(Effect.provide(BunContext.layer)))
})
