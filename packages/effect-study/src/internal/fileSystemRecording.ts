/** Strict single-writer filesystem recording adapter. @since 0.1.0 */
import { Array as Arr, Effect, FileSystem, Number as Num, Option, Path, Schema, Semaphore, String as Str } from "effect"

import * as PersistenceError from "../PersistenceError.js"
import type * as Storage from "../StudyStorage.js"
import { Backend, make, Wire } from "./recording.js"

/** Opens a newline-committed file, validating its complete retained protocol. @since 0.1.0 @category constructors */
export const makeFileSystem = (
  filePath: string
): Effect.Effect<Storage.Recordings["Service"], PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const codec = Schema.fromJsonString(Wire)
    const backendFailure = (operation: "read" | "write") => (cause: { readonly message: string }) =>
      new PersistenceError.Failure({ reason: "Backend", operation, path: filePath, detail: cause.message })
    const invalid = (line: number, detail: string) =>
      new PersistenceError.Failure({
        reason: "Backend",
        operation: "read",
        path: filePath,
        line,
        detail
      })
    const read = Effect.gen(function*() {
      if (!(yield* fs.exists(filePath).pipe(Effect.mapError(backendFailure("read"))))) {
        return Arr.empty<typeof Wire.Type>()
      }
      const text = yield* fs.readFileString(filePath).pipe(Effect.mapError(backendFailure("read")))
      if (Str.isEmpty(text)) return Arr.empty<typeof Wire.Type>()
      const lines = Str.split(text, "\n")
      if (!Str.endsWith("\n")(text)) return yield* invalid(Arr.length(lines), "Incomplete committed-record boundary")
      return yield* Effect.reduce(
        Arr.dropRight(lines, 1),
        () => Arr.empty<typeof Wire.Type>(),
        (prior, line, index) =>
          Effect.gen(function*() {
            const record = yield* Schema.decodeEffect(codec)(line).pipe(
              Effect.mapError((error) => invalid(Num.increment(index), error.message))
            )
            const run = Arr.filter(prior, (entry) => Str.Equivalence(entry.runId, record.runId))
            const header = Arr.head(run)
            if (record._tag === "Opened") {
              if (Option.isSome(header)) return yield* invalid(Num.increment(index), "Duplicate run opening")
            } else {
              if (Option.isNone(header) || !Str.Equivalence(header.value.definitionDigest, record.definitionDigest)) {
                return yield* invalid(Num.increment(index), "Missing or incompatible run definition")
              }
              const events = Arr.filter(run, (entry) => entry._tag === "Event")
              if (
                record._tag === "Event" &&
                (!Num.Equivalence(record.cursor, Num.increment(Arr.length(events))) ||
                  Arr.some(events, (entry) => Str.Equivalence(entry.recordId, record.recordId)))
              ) {
                return yield* invalid(Num.increment(index), "Non-contiguous cursor or duplicate record identity")
              }
              if (record._tag === "Checkpoint" && Num.isGreaterThan(record.through, Arr.length(events))) {
                return yield* invalid(Num.increment(index), "Checkpoint boundary is not committed")
              }
            }
            return Arr.append(prior, record)
          })
      )
    })
    yield* fs.makeDirectory(path.dirname(filePath), { recursive: true }).pipe(Effect.mapError(backendFailure("write")))
    yield* read
    return make(
      new Backend({
        lock: yield* Semaphore.make(1),
        read,
        append: (record) =>
          Schema.encodeEffect(codec)(record).pipe(
            Effect.mapError(PersistenceError.codec("write")),
            Effect.flatMap((encoded) =>
              fs.writeFileString(filePath, Str.concat(encoded, "\n"), { flag: "a" }).pipe(
                Effect.mapError(backendFailure("write"))
              )
            )
          )
      })
    )
  })
