/**
 * Append-only JSON-lines artifact storage backed by the platform filesystem.
 *
 * @since 0.1.0
 */
import { FileSystem, Path } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"

import { ArtifactStorageError } from "../../Errors/Artifact.js"
import { ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"
import { ArtifactSink } from "../ArtifactSink.js"

const ENVELOPE_FILE_NAME = "envelopes.jsonl"

const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

const writeFailure = (path: string) => (cause: { readonly message: string }): ArtifactStorageError =>
  new ArtifactStorageError({ operation: "write", path, detail: cause.message })

/**
 * Builds an artifact sink that appends one encoded envelope per line to
 * `envelopes.jsonl` under the supplied directory.
 *
 * @remarks
 * Layer construction requires platform filesystem and path services and creates the
 * directory recursively; a directory that cannot be created fails the layer with an
 * {@link ArtifactStorageError}. `emit` fails the same way when the envelope cannot be
 * encoded or appended, so its completion means the line reached the filesystem's
 * append call. The sink does not encrypt, redact, sign, or verify envelope contents.
 *
 * @since 0.1.0
 * @category layers
 */
export const fileSystem = (
  directory: string
): Layer.Layer<ArtifactSink, ArtifactStorageError, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    ArtifactSink,
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const filePath = path.join(directory, ENVELOPE_FILE_NAME)

      yield* fs.makeDirectory(directory, { recursive: true }).pipe(Effect.mapError(writeFailure(directory)))

      return {
        emit: (envelope) =>
          Schema.encode(ArtifactEnvelopeJsonSchema)(envelope).pipe(
            Effect.flatMap((encoded) => fs.writeFileString(filePath, `${encoded}\n`, { flag: "a" })),
            Effect.mapError(writeFailure(filePath))
          )
      }
    })
  )
