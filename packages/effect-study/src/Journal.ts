/**
 * Schema-driven, append-only JSON-lines persistence.
 *
 * @since 0.1.0
 * @module
 */
import { Data, Effect, FileSystem, Match, Number as Num, Path, Schema, Semaphore, Stream, String as Str } from "effect"
import type { PlatformError } from "effect/PlatformError"

import * as PersistenceError from "./PersistenceError.js"

/**
 * A single append/read capability whose append operations share one serialization lock.
 * Schema requirements remain on append and read instead of being erased at construction.
 *
 * @since 0.1.0
 * @category models
 */
export class Journal<A, I, RD, RE> extends Data.Class<{
  readonly path: string
  readonly schema: Schema.Codec<A, I, RD, RE>
  readonly append: (entry: A) => Effect.Effect<void, PersistenceError.Failure, RE>
  readonly read: Stream.Stream<A, PersistenceError.Failure, RD>
}> {}

const numberText = Schema.encodeSync(Schema.FiniteFromString)

const storageFailure =
  (operation: PersistenceError.Failure["operation"], path: string) =>
  (cause: PlatformError | Schema.SchemaError): PersistenceError.Failure =>
    new PersistenceError.Failure({
      reason: Schema.isSchemaError(cause) ? "Codec" : "Backend",
      operation,
      path,
      detail: cause.message
    })

const decodeFailure = (path: string, line: number) => (cause: Schema.SchemaError): PersistenceError.Failure =>
  new PersistenceError.Failure({
    reason: "Codec",
    operation: "read",
    path,
    line,
    detail: Str.concat(
      Str.concat(Str.concat("line ", numberText(line)), " is not a journal entry: "),
      cause.message
    )
  })

const readWith = <A, I, RD, RE>(
  fileSystem: FileSystem.FileSystem,
  schema: Schema.Codec<A, I, RD, RE>,
  filePath: string
): Stream.Stream<A, PersistenceError.Failure, RD> => {
  const codec = Schema.fromJsonString(schema)
  return Stream.unwrap(
    fileSystem.exists(filePath).pipe(
      Effect.mapError(storageFailure("read", filePath)),
      Effect.map((exists) =>
        Match.value(exists).pipe(
          Match.when(true, () =>
            fileSystem.stream(filePath).pipe(
              Stream.mapError(storageFailure("read", filePath)),
              Stream.decodeText({ encoding: "utf8" }),
              Stream.splitLines,
              Stream.zipWithIndex,
              Stream.filter(([line]) => Str.isNonEmpty(Str.trim(line))),
              Stream.mapEffect(([line, index]) =>
                Schema.decodeEffect(codec)(line).pipe(
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
 * with PersistenceError.Failure carrying its one-based physical line number.
 *
 * @since 0.1.0
 * @category operations
 */
export const read = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  filePath: string
): Stream.Stream<A, PersistenceError.Failure, FileSystem.FileSystem | RD> =>
  Stream.unwrap(FileSystem.FileSystem.pipe(Effect.map((fileSystem) => readWith(fileSystem, schema, filePath))))

/**
 * Creates a directory-backed journal and a lock shared by all of its appends.
 * Encoding and appending occur under the same lock, and each successful append writes
 * exactly one schema-encoded JSON value followed by a newline.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  directory: string,
  fileName: string
): Effect.Effect<Journal<A, I, RD, RE>, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const filePath = path.join(directory, fileName)
    const lock = yield* Semaphore.make(1)
    const codec = Schema.fromJsonString(schema)
    yield* fileSystem.makeDirectory(directory, { recursive: true }).pipe(
      Effect.mapError(storageFailure("write", directory))
    )
    return new Journal({
      path: filePath,
      schema,
      append: (entry) =>
        lock.withPermits(1)(
          Schema.encodeEffect(codec)(entry).pipe(
            Effect.flatMap((encoded) => fileSystem.writeFileString(filePath, Str.concat(encoded, "\n"), { flag: "a" })),
            Effect.mapError(storageFailure("write", filePath))
          )
        ),
      read: readWith(fileSystem, schema, filePath)
    })
  })
