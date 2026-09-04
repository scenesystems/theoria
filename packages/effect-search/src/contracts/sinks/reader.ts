/**
 * Decoding of JSON-lines artifact logs.
 *
 * @since 0.1.0
 */
import { FileSystem } from "@effect/platform"
import { Effect, Schema, Stream } from "effect"

import { ArtifactStorageError } from "../../Errors/Artifact.js"
import { type ArtifactEnvelope, ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"

const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

const readFailure = (path: string) => (cause: { readonly message: string }): ArtifactStorageError =>
  new ArtifactStorageError({ operation: "read", path, detail: cause.message })

/**
 * Streams valid artifact envelopes from a UTF-8 JSON-lines file in source order.
 *
 * @remarks
 * A file that does not exist yields an empty stream: an absent log is the state before
 * the first write, not a failure. A file that cannot be examined or read fails the stream
 * with an {@link ArtifactStorageError}. Blank and schema-invalid lines are skipped, because
 * an append-only log interrupted mid-write legitimately ends in a torn line and the
 * envelopes before it remain valid. Decoding validates structure but does not
 * authenticate producers or verify lineage digests.
 *
 * @since 0.1.0
 * @category readers
 */
export const readEnvelopeLog = (
  filePath: string
): Stream.Stream<ArtifactEnvelope, ArtifactStorageError, FileSystem.FileSystem> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const exists = yield* fs.exists(filePath)
      return exists
        ? fs.stream(filePath).pipe(
          Stream.decodeText("utf8"),
          Stream.splitLines,
          Stream.filter((line) => line.trim().length > 0),
          Stream.mapEffect((line) => Schema.decode(ArtifactEnvelopeJsonSchema)(line).pipe(Effect.option)),
          Stream.filterMap((option) => option)
        )
        : Stream.empty
    })
  ).pipe(Stream.mapError(readFailure(filePath)))
