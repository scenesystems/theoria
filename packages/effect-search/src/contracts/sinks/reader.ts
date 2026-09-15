/**
 * Decoding of JSON-lines artifact logs.
 *
 * @since 0.1.0
 */
import type { FileSystem } from "@effect/platform"
import * as Journal from "@scenesystems/effect-study/Journal"
import { Option, Stream, String as Str } from "effect"

import { ArtifactStorageError } from "../../Errors/Artifact.js"
import { type ArtifactEnvelope, ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"

const readFailure = (cause: Journal.JournalError): ArtifactStorageError =>
  new ArtifactStorageError({
    operation: "read",
    path: cause.path,
    detail: Option.fromNullable(cause.line).pipe(
      Option.match({
        onNone: () => cause.detail,
        onSome: () => Str.replace("is not a journal entry", "is not an artifact envelope")(cause.detail)
      })
    )
  })

/**
 * Streams artifact envelopes from a UTF-8 JSON-lines file in source order.
 *
 * @remarks
 * A file that does not exist yields an empty stream: an absent log is the state before
 * the first write, not a failure. A file that cannot be examined or read fails the stream
 * with an {@link ArtifactStorageError}. Blank lines are skipped. Every other line must
 * decode as an envelope; one that does not, including a final line torn by an interrupted
 * append, fails the stream with an {@link ArtifactStorageError} naming the line. A torn
 * tail is not skipped because the next append would land on the same line and corrupt a
 * later envelope; repairing a log is an explicit operation, not a side effect of reading
 * it. Decoding validates structure but does not authenticate producers or verify lineage
 * digests.
 *
 * @since 0.1.0
 * @category readers
 */
export const readEnvelopeLog = (
  filePath: string
): Stream.Stream<ArtifactEnvelope, ArtifactStorageError, FileSystem.FileSystem> =>
  Journal.read(ArtifactEnvelopeSchema, filePath).pipe(Stream.mapError(readFailure))
