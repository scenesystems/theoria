/**
 * Schema-driven, append-only JSON-lines persistence.
 *
 * @since 0.1.0
 * @module
 */
import { FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Data, Effect, Match, Number as Num, ParseResult, Schema, Stream, String as Str } from "effect"

/**
 * Reports a journal codec or filesystem failure.
 * A decoding failure carries its one-based physical line number.
 *
 * @since 0.1.0
 * @category errors
 */
export class JournalError extends Schema.TaggedError<JournalError>()("effect-study/JournalError", {
  operation: Schema.Literal("write", "read"),
  path: Schema.String,
  line: Schema.optional(Schema.Positive.pipe(Schema.int())),
  detail: Schema.String
}) {}

/**
 * A single append/read capability whose append operations share one serialization lock.
 * Schema requirements remain on append and read instead of being erased at construction.
 *
 * @since 0.1.0
 * @category models
 */
export class Journal<A, I, R> extends Data.Class<{
  readonly path: string
  readonly schema: Schema.Schema<A, I, R>
  readonly append: (entry: A) => Effect.Effect<void, JournalError, R>
  readonly read: Stream.Stream<A, JournalError, R>
}> {}

const numberText = Schema.encodeSync(Schema.NumberFromString)

const storageFailure =
  (operation: JournalError["operation"], path: string) =>
  (cause: PlatformError | ParseResult.ParseError): JournalError =>
    new JournalError({ operation, path, detail: cause.message })

const decodeFailure = (path: string, line: number) => (cause: ParseResult.ParseError): JournalError =>
  new JournalError({
    operation: "read",
    path,
    line,
    detail: Str.concat(
      Str.concat(Str.concat("line ", numberText(line)), " is not a journal entry: "),
      ParseResult.TreeFormatter.formatErrorSync(cause)
    )
  })

const readWith = <A, I, R>(
  fileSystem: FileSystem.FileSystem,
  schema: Schema.Schema<A, I, R>,
  filePath: string
): Stream.Stream<A, JournalError, R> => {
  const codec = Schema.parseJson(schema)
  return Stream.unwrap(
    fileSystem.exists(filePath).pipe(
      Effect.mapError(storageFailure("read", filePath)),
      Effect.map((exists) =>
        Match.value(exists).pipe(
          Match.when(true, () =>
            fileSystem.stream(filePath).pipe(
              Stream.mapError(storageFailure("read", filePath)),
              Stream.decodeText("utf8"),
              Stream.splitLines,
              Stream.zipWithIndex,
              Stream.filter(([line]) => Str.isNonEmpty(Str.trim(line))),
              Stream.mapEffect(([line, index]) =>
                Schema.decode(codec)(line).pipe(
                  Effect.mapError(decodeFailure(filePath, Num.increment(index)))
                )
              )
            )),
          Match.when(false, () => Stream.empty),
          Match.exhaustive
        )
      )
    )
  )
}

/**
 * Reads a UTF-8 JSON-lines file in physical line order.
 * Missing files are empty, blank lines are ignored, and every malformed line fails
 * with a {@link JournalError} carrying its one-based physical line number.
 *
 * @since 0.1.0
 * @category readers
 */
export const read = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  filePath: string
): Stream.Stream<A, JournalError, FileSystem.FileSystem | R> =>
  Stream.unwrap(FileSystem.FileSystem.pipe(Effect.map((fileSystem) => readWith(fileSystem, schema, filePath))))

/**
 * Creates a directory-backed journal and a lock shared by all of its appends.
 * Encoding and appending occur under the same lock, and each successful append writes
 * exactly one schema-encoded JSON value followed by a newline.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  directory: string,
  fileName: string
): Effect.Effect<Journal<A, I, R>, JournalError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const filePath = path.join(directory, fileName)
    const lock = yield* Effect.makeSemaphore(1)
    const codec = Schema.parseJson(schema)
    yield* fileSystem.makeDirectory(directory, { recursive: true }).pipe(
      Effect.mapError(storageFailure("write", directory))
    )
    return new Journal({
      path: filePath,
      schema,
      append: (entry) =>
        lock.withPermits(1)(
          Schema.encode(codec)(entry).pipe(
            Effect.flatMap((encoded) => fileSystem.writeFileString(filePath, Str.concat(encoded, "\n"), { flag: "a" })),
            Effect.mapError(storageFailure("write", filePath))
          )
        ),
      read: readWith(fileSystem, schema, filePath)
    })
  })
