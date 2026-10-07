/** Producer-owned artifact delivery and generic structured observation persistence. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Array as Arr, Effect, FileSystem, Option, Schema } from "effect"

import * as ArtifactSink from "@scenesystems/effect-study/ArtifactSink"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const Measurement = Schema.Struct({
  sample: Schema.NonEmptyString,
  values: Schema.Array(Schema.FiniteFromString)
})

const Snapshot = Schema.Struct({ completed: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) })

const program = Effect.scoped(
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-persistence-example-" })
    const artifactSink = yield* ArtifactSink.makeFileSystem(directory)
    const storage = yield* StudyStorage.makeFileSystem(StudyStorage.fileSystemOptions(directory))
    const measurement = { sample: "assay-1", values: Arr.make(1.25, 2.5) }
    const recording = yield* storage.open(
      new StudyStorage.OpenOptions({
        runId: "assay",
        definitionDigest: "measurement-snapshot",
        eventSchema: Measurement,
        checkpointSchema: Snapshot
      })
    )

    yield* artifactSink.emit(Measurement, measurement)
    const receipt = yield* recording.append(
      new StudyStorage.Append({ recordId: "assay-1", expectedCursor: 0, event: measurement })
    )
    yield* recording.writeCheckpoint(
      new StudyStorage.CheckpointWrite({ through: receipt.cursor, state: { completed: 1 } })
    )

    const latest = yield* recording.loadCheckpoint
    yield* Option.match(latest, {
      onNone: () => Effect.log("no snapshot"),
      onSome: Effect.log
    })
  })
)

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
