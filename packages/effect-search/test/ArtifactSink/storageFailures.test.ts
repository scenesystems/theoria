import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import { Array as Arr, Chunk, DateTime, Effect, Either, Ref, Schema, Stream } from "effect"

import * as Artifact from "../../src/Artifact.js"
import * as ArtifactSink from "../../src/ArtifactSink.js"
import { ArtifactStorageError } from "../../src/SearchError.js"

const makeEnvelope = Effect.gen(function*() {
  const runId = yield* Schema.decode(StudyArtifact.RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(StudyArtifact.PackageVersion)("0.7.0")
  const emittedAt = yield* DateTime.make("2024-01-01T00:00:00Z")
  const sourceRef = yield* Schema.decodeUnknown(Artifact.Source)({
    origin: "effect-search",
    domain: "test",
    segments: Arr.of("artifact")
  })
  return Artifact.Custom({
    schemaVersion: "artifact-envelope/v1",
    producer: Artifact.EffectSearch({ packageVersion, component: Arr.of("Artifact"), runId }),
    lineage: {
      sourceRef,
      artifactId: new StudyArtifact.Id({ runId, sequence: 0 }),
      emittedAt
    },
    payload: { completed: true }
  })
})

describe("ArtifactSink", () => {
  it.scoped("appends and reads envelopes through the canonical journal", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-" })
      const envelope = yield* makeEnvelope

      yield* ArtifactSink.emit(envelope).pipe(Effect.provide(ArtifactSink.layerFileSystem(directory)))
      const stored = yield* ArtifactSink.read(path.join(directory, "envelopes.jsonl")).pipe(Stream.runCollect)

      expect(Chunk.toArray(stored)).toEqual([envelope])
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("reports malformed lines with typed read failures", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-corrupt-" })
      const filePath = path.join(directory, "envelopes.jsonl")
      yield* fileSystem.writeFileString(filePath, "{}\n")

      const result = yield* ArtifactSink.read(filePath).pipe(Stream.runCollect, Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(ArtifactStorageError)
        expect(result.left.operation).toBe("read")
        expect(result.left.detail).toContain("line 1 is not an artifact envelope")
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("fails layer acquisition when the journal directory cannot be created", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-artifact-blocked-" })
      const blocker = path.join(directory, "blocker")
      yield* fileSystem.writeFileString(blocker, "not a directory")

      const result = yield* ArtifactSink.ArtifactSink.pipe(
        Effect.provide(ArtifactSink.layerFileSystem(path.join(blocker, "nested"))),
        Effect.either
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(ArtifactStorageError)
        expect(result.left.operation).toBe("write")
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("fanout preserves left-to-right delivery order", () =>
    Effect.gen(function*() {
      const envelope = yield* makeEnvelope
      const delivered = yield* Ref.make(Arr.empty<string>())
      const left: ArtifactSink.Service = {
        emit: () => Ref.update(delivered, Arr.append("left"))
      }
      const right: ArtifactSink.Service = {
        emit: () => Ref.update(delivered, Arr.append("right"))
      }

      yield* ArtifactSink.fanout(left, right).emit(envelope)

      expect(yield* Ref.get(delivered)).toEqual(["left", "right"])
    }))
})
