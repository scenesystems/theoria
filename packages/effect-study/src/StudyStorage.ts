/**
 * Schema-parameterized trial logs and study snapshots.
 *
 * @since 0.1.0
 * @module
 */
import type { FileSystem, Path } from "@effect/platform"
import {
  Array as Arr,
  Chunk,
  Data,
  Effect,
  Layer,
  Option,
  ParseResult,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"
import type * as Context from "effect/Context"

import * as Journal from "./Journal.js"

const defaultFileName = "study-storage.jsonl"
const memoryPath = "memory://effect-study/StudyStorage"

const PersistedRecord = Schema.Union(
  Schema.TaggedStruct("Trial", {
    payload: Schema.Unknown
  }),
  Schema.TaggedStruct("Snapshot", {
    payload: Schema.Unknown
  })
)

type PersistedRecord = typeof PersistedRecord.Type

/**
 * Filesystem location for a generic storage journal.
 *
 * @since 0.1.0
 * @category models
 */
export class FileSystemOptions extends Data.Class<{
  readonly directory: string
  readonly fileName: string
}> {}

/**
 * Creates filesystem options for the study journal.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fileSystemOptions = (
  directory: string,
  fileName = defaultFileName
): FileSystemOptions => new FileSystemOptions({ directory, fileName })

/**
 * Persists and loads trials and snapshots through caller-owned schemas.
 * Codec requirements remain on each operation.
 *
 * @since 0.1.0
 * @category services
 */
export class StudyStorage extends Effect.Tag("effect-study/StudyStorage")<
  StudyStorage,
  {
    readonly appendTrial: <A, I, R>(schema: Schema.Schema<A, I, R>, trial: A) => Effect.Effect<void, Journal.Failure, R>
    readonly writeSnapshot: <A, I, R>(
      schema: Schema.Schema<A, I, R>,
      snapshot: A
    ) => Effect.Effect<void, Journal.Failure, R>
    readonly loadSnapshot: <A, I, R>(
      schema: Schema.Schema<A, I, R>
    ) => Effect.Effect<Option.Option<A>, Journal.Failure, R>
    readonly loadTrialLog: <A, I, R>(
      schema: Schema.Schema<A, I, R>
    ) => Effect.Effect<Schema.Schema.Type<Schema.Array$<Schema.Schema<A>>>, Journal.Failure, R>
  }
>() {}

/** Generic study storage implementation. @since 0.1.0 @category models */
export type Service = Context.Tag.Service<typeof StudyStorage>

const codecFailure =
  (operation: Journal.Failure["operation"], path: string) => (cause: ParseResult.ParseError): Journal.Failure =>
    new Journal.Failure({
      operation,
      path,
      detail: ParseResult.TreeFormatter.formatErrorSync(cause)
    })

const encodeRecord = <A, I, R>(
  path: string,
  tag: PersistedRecord["_tag"],
  schema: Schema.Schema<A, I, R>,
  value: A
): Effect.Effect<PersistedRecord, Journal.Failure, R> =>
  Schema.encode(schema)(value).pipe(
    Effect.mapError(codecFailure("write", path)),
    Effect.map((payload) => ({ _tag: tag, payload }))
  )

const decodeRecord = <A, I, R>(
  path: string,
  schema: Schema.Schema<A, I, R>,
  record: PersistedRecord
): Effect.Effect<A, Journal.Failure, R> =>
  Schema.decodeUnknown(schema)(record.payload).pipe(Effect.mapError(codecFailure("read", path)))

const service = (
  path: string,
  append: (record: PersistedRecord) => Effect.Effect<void, Journal.Failure>,
  load: Effect.Effect<Schema.Schema.Type<Schema.Array$<typeof PersistedRecord>>, Journal.Failure>
): Service => ({
  appendTrial: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    trial: A
  ): Effect.Effect<void, Journal.Failure, R> => encodeRecord(path, "Trial", schema, trial).pipe(Effect.flatMap(append)),
  writeSnapshot: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    snapshot: A
  ): Effect.Effect<void, Journal.Failure, R> =>
    encodeRecord(path, "Snapshot", schema, snapshot).pipe(Effect.flatMap(append)),
  loadSnapshot: <A, I, R>(
    schema: Schema.Schema<A, I, R>
  ): Effect.Effect<Option.Option<A>, Journal.Failure, R> =>
    load.pipe(
      Effect.map((records) => Arr.findLast(records, (record) => Str.Equivalence(record._tag, "Snapshot"))),
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.succeed(Option.none<A>()),
          onSome: (record) => decodeRecord(path, schema, record).pipe(Effect.asSome)
        })
      )
    ),
  loadTrialLog: <A, I, R>(
    schema: Schema.Schema<A, I, R>
  ): Effect.Effect<Schema.Schema.Type<Schema.Array$<Schema.Schema<A>>>, Journal.Failure, R> =>
    load.pipe(
      Effect.map((records) => Arr.filter(records, (record) => Str.Equivalence(record._tag, "Trial"))),
      Effect.flatMap((records) => Effect.forEach(records, (record) => decodeRecord(path, schema, record)))
    )
})

/**
 * Creates isolated in-memory trial and snapshot persistence.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeMemory = (): Effect.Effect<Service> =>
  Ref.make(Arr.empty<PersistedRecord>()).pipe(
    Effect.map((records) =>
      service(
        memoryPath,
        (record) => Ref.update(records, Arr.append(record)),
        Ref.get(records)
      )
    )
  )

/**
 * Provides isolated in-memory trial and snapshot persistence.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerMemory: Layer.Layer<StudyStorage> = Layer.effect(StudyStorage, makeMemory())

/**
 * Creates generic persistence over one append-only JSON-lines journal.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeFileSystem = (
  options: FileSystemOptions
): Effect.Effect<Service, Journal.Failure, FileSystem.FileSystem | Path.Path> =>
  Journal.make(PersistedRecord, options.directory, options.fileName).pipe(
    Effect.map((journal) =>
      service(
        journal.path,
        journal.append,
        journal.read.pipe(Stream.runCollect, Effect.map(Chunk.toArray))
      )
    )
  )

/**
 * Provides generic filesystem-backed trial and snapshot persistence.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerFileSystem = (
  options: FileSystemOptions
): Layer.Layer<StudyStorage, Journal.Failure, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(StudyStorage, makeFileSystem(options))

/** Installs an existing generic study storage service. @since 0.1.0 @category layers */
export const layer = (storage: Service): Layer.Layer<StudyStorage> => Layer.succeed(StudyStorage, storage)

/** Appends a trial through ambient generic storage. @since 0.1.0 @category combinators */
export const appendTrial = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  trial: A
): Effect.Effect<void, Journal.Failure, StudyStorage | R> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.appendTrial(schema, trial)))

/** Writes a snapshot through ambient generic storage. @since 0.1.0 @category combinators */
export const writeSnapshot = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  snapshot: A
): Effect.Effect<void, Journal.Failure, StudyStorage | R> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.writeSnapshot(schema, snapshot)))

/** Loads the latest snapshot through ambient generic storage. @since 0.1.0 @category combinators */
export const loadSnapshot = <A, I, R>(
  schema: Schema.Schema<A, I, R>
): Effect.Effect<Option.Option<A>, Journal.Failure, StudyStorage | R> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.loadSnapshot(schema)))

/** Loads the complete trial log through ambient generic storage. @since 0.1.0 @category combinators */
export const loadTrialLog = <A, I, R>(
  schema: Schema.Schema<A, I, R>
): Effect.Effect<Schema.Schema.Type<Schema.Array$<Schema.Schema<A>>>, Journal.Failure, StudyStorage | R> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.loadTrialLog(schema)))
