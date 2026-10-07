import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Result, Schema, Stream } from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const options = new StudyStorage.OpenOptions({
  runId: "observations",
  definitionDigest: "observations-definition",
  eventSchema: Schema.String,
  checkpointSchema: Schema.Int
})

it.effect("allocates independent recordings when the same memory layer is provided twice", () =>
  Effect.gen(function*() {
    const layer = StudyStorage.layerMemory
    yield* StudyStorage.open(options).pipe(
      Effect.flatMap((run) =>
        run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "first" }))
      ),
      Effect.provide(layer)
    )
    const entries = yield* StudyStorage.open(options).pipe(
      Effect.flatMap((run) => run.read().pipe(Stream.runCollect)),
      Effect.provide(layer)
    )
    expect(entries).toEqual([])
  }))

it.effect("writes the run protocol directly to the configured file and reopens its checkpoint", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    const config = StudyStorage.fileSystemOptions(directory, "observations.jsonl")
    const run = yield* (yield* StudyStorage.makeFileSystem(config)).open(options)
    yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "first" }))
    yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: 7 }))
    const raw = yield* fs.readFileString(path.join(directory, config.fileName))
    expect(raw).toContain("\"_tag\":\"Opened\"")
    expect(raw).toContain("\"_tag\":\"Checkpoint\"")
    const reopened = yield* (yield* StudyStorage.makeFileSystem(config)).open(options)
    expect((yield* Effect.fromOption(yield* reopened.loadCheckpoint)).state).toBe(7)
    expect(yield* reopened.read().pipe(Stream.runCollect)).toHaveLength(1)
  }).pipe(Effect.provide(BunServices.layer)))

it.effect("rejects unknown record kinds without modifying the file", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    const config = StudyStorage.fileSystemOptions(directory)
    const file = path.join(directory, config.fileName)
    const content =
      "{\"_tag\":\"UnknownRecord\",\"runId\":\"observations\",\"definitionDigest\":\"observations-definition\"}\n"
    yield* fs.writeFileString(file, content)
    const result = yield* StudyStorage.makeFileSystem(config).pipe(Effect.result)
    const failure = yield* Effect.fromResult(Result.flip(result))
    expect(failure.reason).toBe("Codec")
    expect(failure.path).toBe(file)
    expect(failure.line).toBe(1)
    expect(yield* fs.readFileString(file)).toBe(content)
  }).pipe(Effect.provide(BunServices.layer)))
