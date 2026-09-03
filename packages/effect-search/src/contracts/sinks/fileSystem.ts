/**
 * Append-only JSON-lines artifact storage backed by the platform filesystem.
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
 * Builds an artifact sink that appends one encoded envelope per line to
 * `envelopes.jsonl` under the supplied directory.
 *
 * @remarks
 * Layer construction requires platform filesystem and path services and attempts
 * recursive directory creation. Directory, encoding, and append failures are discarded,
 * so successful `emit` completion does not prove that data reached disk. The sink does
 * not encrypt, redact, sign, or verify envelope contents.
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
