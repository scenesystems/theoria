/**
 * Stream-based envelope reader — deserializes JSONL files into typed artifact envelopes.
 *
 * @since 0.1.0
 */
import { FileSystem } from "@effect/platform"
import { Effect, Schema, Stream } from "effect"

import { type ArtifactEnvelope, ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"

const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

/**
 * Reads an envelope JSONL file as a stream of decoded artifact envelopes.
 *
 * @remarks
 * Blank and schema-invalid lines are skipped. A missing file, an existence-check
 * failure, or a read/stream failure yields an empty stream. Decoding validates
 * structure only; it does not authenticate producers or verify lineage digests.
 *
 * @since 0.1.0
 * @category readers
 */
export const readEnvelopeLog = (
  filePath: string
): Stream.Stream<ArtifactEnvelope, never, FileSystem.FileSystem> =>
  Stream.unwrap(
    FileSystem.FileSystem.pipe(
      Effect.flatMap((fs) =>
        fs.exists(filePath).pipe(
          Effect.map((exists) =>
            exists
              ? fs.stream(filePath).pipe(
                Stream.decodeText("utf8"),
                Stream.splitLines,
                Stream.filter((line) => line.trim().length > 0),
                Stream.mapEffect((line) =>
                  Schema.decode(ArtifactEnvelopeJsonSchema)(line).pipe(
                    Effect.option
                  )
                ),
                Stream.filterMap((option) => option),
                Stream.catchAll(() => Stream.empty)
              )
              : Stream.empty
          ),
          Effect.catchAll(() => Effect.succeed(Stream.empty))
        )
      )
    )
  )
