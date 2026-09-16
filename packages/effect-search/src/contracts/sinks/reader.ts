/**
 * Decoding of JSON-lines artifact logs.
 *
 * @since 0.1.0
 */
import type { Error as PlatformError } from "@effect/platform"
import { FileSystem } from "@effect/platform"
import { Array as Arr, Boolean, Effect, Inspectable, Number, ParseResult, Schema, Stream, String } from "effect"

import { ArtifactStorageError } from "../../Errors/Artifact.js"
import { type ArtifactEnvelope, ArtifactEnvelopeSchema } from "../ArtifactEnvelope.js"

const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

const readFailure = (path: string) => (cause: PlatformError.PlatformError): ArtifactStorageError =>
  new ArtifactStorageError({ operation: "read", path, detail: cause.message })

/** Issue paths and messages only; the envelope schema itself is too large to repeat per line. */
const describeIssues = (error: ParseResult.ParseError): string =>
  Arr.join(
    Arr.map(ParseResult.ArrayFormatter.formatErrorSync(error), (issue) =>
      Boolean.match(Arr.isEmptyReadonlyArray(issue.path), {
        onTrue: () =>
          issue.message,
        onFalse: () =>
          String.concat(
            String.concat(Arr.join(Arr.map(issue.path, (key) => Inspectable.toStringUnknown(key)), "."), ": "),
            issue.message
          )
      })),
    "; "
  )

const corruptLine = (
  path: string,
  lineNumber: number,
  error: ParseResult.ParseError
): ArtifactStorageError =>
  new ArtifactStorageError({
    operation: "read",
    path,
    detail: `line ${lineNumber} is not an artifact envelope: ${describeIssues(error)}`
  })

const decodeLine = (
  path: string,
  line: string,
  lineNumber: number
): Effect.Effect<ArtifactEnvelope, ArtifactStorageError> =>
  Schema.decode(ArtifactEnvelopeJsonSchema)(line).pipe(
    Effect.mapError((error) => corruptLine(path, lineNumber, error))
  )

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
  Stream.unwrap(
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const exists = yield* fs.exists(filePath).pipe(Effect.mapError(readFailure(filePath)))
      return Boolean.match(exists, {
        onTrue: () =>
          fs.stream(filePath).pipe(
            Stream.mapError(readFailure(filePath)),
            Stream.decodeText("utf8"),
            Stream.splitLines,
            Stream.zipWithIndex,
            Stream.filter(([line]) => String.isNonEmpty(String.trim(line))),
            Stream.mapEffect(([line, index]) => decodeLine(filePath, line, Number.increment(index)))
          ),
        onFalse: () => Stream.empty
      })
    })
  )
