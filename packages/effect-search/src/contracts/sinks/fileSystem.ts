/**
 * File-system envelope sink — writes envelope JSONL to disk.
 *
 * @since 0.1.0
 */
import { FileSystem, Path } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"

import { ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"
import { ArtifactSink } from "../ArtifactSink.js"

const ENVELOPE_FILE_NAME = "envelopes.jsonl"

const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

/**
 * File-system sink layer — writes each envelope as a JSON line.
 *
 * @since 0.1.0
 * @category layers
 */
export const fileSystem = (directory: string): Layer.Layer<ArtifactSink, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    ArtifactSink,
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const filePath = path.join(directory, ENVELOPE_FILE_NAME)

      yield* fs.makeDirectory(directory, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))

      return {
        emit: (envelope) =>
          Schema.encode(ArtifactEnvelopeJsonSchema)(envelope).pipe(
            Effect.flatMap((encoded) => fs.writeFileString(filePath, `${encoded}\n`, { flag: "a" })),
            Effect.catchAll(() => Effect.void)
          )
      }
    })
  )
