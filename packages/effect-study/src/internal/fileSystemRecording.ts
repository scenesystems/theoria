/** Strict single-writer filesystem recording adapter. @since 0.1.0 */
import {
  Array as Arr,
  Data,
  DateTime,
  Effect,
  Equal,
  FileSystem,
  HashMap,
  Number as Num,
  Option,
  Path,
  Ref,
  Schema,
  Semaphore,
  String as Str
} from "effect"

import * as PersistenceError from "../PersistenceError.js"
import type * as Storage from "../StudyStorage.js"
import { accept, Backend, make, type Run, Wire } from "./recording.js"

class Stamp extends Data.Class<{
  readonly size: FileSystem.File.Info["size"]
  readonly modified: Option.Option<number>
  readonly inode: Option.Option<number>
}> {}
class Cached extends Data.Class<{ readonly stamp: Stamp; readonly runs: HashMap.HashMap<string, Run> }> {}
const stamp = (info: FileSystem.File.Info) =>
  new Stamp({
    size: info.size,
    modified: Option.map(info.mtime, (date) => DateTime.toEpochMillis(DateTime.makeUnsafe(date))),
    inode: info.ino
  })

/** Opens a newline-committed file and indexes each retained record once. @since 0.1.0 @category constructors */
export const makeFileSystem = (
  filePath: string
): Effect.Effect<Storage.Service["open"], PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const cache = yield* Ref.make(Option.none<Cached>())
    const codec = Schema.fromJsonString(Wire)
    const backendFailure = (operation: "read" | "write") => (cause: { readonly message: string }) =>
      new PersistenceError.Failure({ reason: "Backend", operation, path: filePath, detail: cause.message })
    const atLine = (line: number) => (error: PersistenceError.Failure) =>
      new PersistenceError.Failure({
        reason: error.reason,
        operation: error.operation,
        detail: error.detail,
        path: filePath,
        line
      })
    const read = Effect.gen(function*() {
      if (!(yield* fs.exists(filePath).pipe(Effect.mapError(backendFailure("read"))))) {
        return HashMap.empty<string, Run>()
      }
      const current = stamp(yield* fs.stat(filePath).pipe(Effect.mapError(backendFailure("read"))))
      const prior = yield* Ref.get(cache)
      if (Option.isSome(prior) && Option.isSome(current.modified) && Equal.equals(prior.value.stamp, current)) {
        return prior.value.runs
      }
      const text = yield* fs.readFileString(filePath).pipe(Effect.mapError(backendFailure("read")))
      const lines = Str.isEmpty(text) ? Arr.empty<string>() : Str.split(text, "\n")
      if (Str.isNonEmpty(text) && !Str.endsWith("\n")(text)) {
        return yield* new PersistenceError.Failure({
          reason: "Backend",
          operation: "read",
          path: filePath,
          line: Arr.length(lines),
          detail: "Incomplete committed-record boundary"
        })
      }
      const runs = yield* Effect.reduce(
        Arr.dropRight(lines, 1),
        () => HashMap.empty<string, Run>(),
        (runs, line, index) =>
          Schema.decodeEffect(codec)(line).pipe(
            Effect.mapError(PersistenceError.codec("read")),
            Effect.flatMap((record) => accept(runs, record)),
            Effect.mapError(atLine(Num.increment(index)))
          )
      )
      yield* Ref.set(cache, Option.some(new Cached({ stamp: current, runs })))
      return runs
    })
    yield* fs.makeDirectory(path.dirname(filePath), { recursive: true }).pipe(Effect.mapError(backendFailure("write")))
    yield* read
    return make(
      new Backend({
        lock: yield* Semaphore.make(1),
        read,
        append: (record) =>
          Effect.gen(function*() {
            const runs = yield* accept(yield* read, record)
            const encoded = yield* Schema.encodeEffect(codec)(record).pipe(
              Effect.mapError(PersistenceError.codec("write"))
            )
            // An interrupted or failed append leaves no trusted cache. A retry revalidates.
            yield* Ref.set(cache, Option.none())
            yield* fs.writeFileString(filePath, Str.concat(encoded, "\n"), { flag: "a" }).pipe(
              Effect.mapError(backendFailure("write"))
            )
            const current = stamp(yield* fs.stat(filePath).pipe(Effect.mapError(backendFailure("write"))))
            yield* Ref.set(cache, Option.some(new Cached({ stamp: current, runs })))
          })
      })
    )
  })
