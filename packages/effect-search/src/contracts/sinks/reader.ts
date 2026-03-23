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
 * Read an envelope JSONL file and return a stream of decoded artifact envelopes.
 *
 * Lines that fail to decode are silently skipped — this matches the existing
 * `loadEnvelopes` behavior that treats malformed lines as `Option.none()`.
 *
 * Returns an empty stream when the file does not exist or cannot be read.
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
