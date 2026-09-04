/**
 * Decoding of JSON-lines artifact logs.
 *
 * @since 0.1.0
 */
import { FileSystem } from "@effect/platform"
import { Effect, Option, ParseResult, Schema, Stream } from "effect"

import { ArtifactStorageError } from "../../Errors/Artifact.js"
import { type ArtifactEnvelope, ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"

const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

const readFailure = (path: string) => (cause: { readonly message: string }): ArtifactStorageError =>
  new ArtifactStorageError({ operation: "read", path, detail: cause.message })

const corruptLine = (
  path: string,
  lineNumber: number,
  error: ParseResult.ParseError
): ArtifactStorageError =>
  new ArtifactStorageError({
    operation: "read",
    path,
    detail: `line ${lineNumber} is not an artifact envelope: ${ParseResult.TreeFormatter.formatErrorSync(error)}`
  })

/** A numbered non-blank line paired with whether another non-blank line follows it. */
type PositionedLine = readonly [line: string, lineNumber: number, hasSuccessor: boolean]

const decodeLine = (
  path: string,
  [line, lineNumber, hasSuccessor]: PositionedLine
): Effect.Effect<Option.Option<ArtifactEnvelope>, ArtifactStorageError> =>
  Schema.decode(ArtifactEnvelopeJsonSchema)(line).pipe(
    Effect.asSome,
    Effect.catchAll((error) =>
      hasSuccessor
        ? Effect.fail(corruptLine(path, lineNumber, error))
        : Effect.succeedNone
    )
  )

/**
 * Streams artifact envelopes from a UTF-8 JSON-lines file in source order.
 *
 * @remarks
 * A file that does not exist yields an empty stream: an absent log is the state before
 * the first write, not a failure. A file that cannot be examined or read fails the stream
 * with an {@link ArtifactStorageError}. Blank lines are skipped. The final non-blank line
 * may be torn, because an append-only log interrupted mid-write legitimately ends that
 * way and the envelopes before it remain valid; an undecodable line anywhere else means
 * the log was corrupted or written by something other than an artifact sink, and fails
 * the stream with an {@link ArtifactStorageError} naming the line. Decoding validates
 * structure but does not authenticate producers or verify lineage digests.
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
      const exists = yield* fs.exists(filePath).pipe(Effect.mapError(readFailure(filePath)))
      return exists
        ? fs.stream(filePath).pipe(
          Stream.mapError(readFailure(filePath)),
          Stream.decodeText("utf8"),
          Stream.splitLines,
          Stream.zipWithIndex,
          Stream.filter(([line]) => line.trim().length > 0),
          Stream.zipWithNext,
          Stream.mapEffect(([[line, index], next]) => decodeLine(filePath, [line, index + 1, Option.isSome(next)])),
          Stream.filterMap((option) => option)
        )
        : Stream.empty
    })
  )
