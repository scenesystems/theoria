/**
 * Best-effort decoding of JSON-lines artifact logs.
 *
 * @since 0.1.0
 */
import { FileSystem } from "@effect/platform"
import { Effect, Schema, Stream } from "effect"

import { type ArtifactEnvelope, ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"

const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

/**
 * Streams valid artifact envelopes from a UTF-8 JSON-lines file in source order.
 *
 * @remarks
 * Blank and schema-invalid lines are omitted. A missing file or failed existence check
 * produces an empty stream. A read failure ends the stream without a typed error and may
 * occur after earlier envelopes were emitted. Decoding validates structure but does not
 * authenticate producers or verify lineage digests.
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
