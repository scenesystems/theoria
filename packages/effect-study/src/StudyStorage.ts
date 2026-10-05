/**
 * Schema-parameterized trial logs and study snapshots.
 *
 * @since 0.1.0
 * @module
 */
import {
  Array as Arr,
  Context,
  Data,
  Effect,
  type FileSystem,
  Layer,
  Option,
  type Path,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"

import * as fileSystemRecording from "./internal/fileSystemRecording.js"
import * as recording from "./internal/recording.js"
import * as Journal from "./Journal.js"
import * as PersistenceError from "./PersistenceError.js"

const defaultFileName = "study-storage.jsonl"
const memoryPath = "memory://effect-study/StudyStorage"

const PersistedRecord = Schema.Union([
  Schema.TaggedStruct("Trial", {
    payload: Schema.Unknown
  }),
  Schema.TaggedStruct("Snapshot", {
    payload: Schema.Unknown
  })
]).pipe(Schema.annotate({ identifier: "@scenesystems/effect-study/StudyStorage/PersistedRecord" }))

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
export class StudyStorage extends Context.Service<
  StudyStorage,
  {
    readonly appendTrial: <A, I, RD, RE>(
      schema: Schema.Codec<A, I, RD, RE>,
      trial: A
    ) => Effect.Effect<void, PersistenceError.Failure, RE>
    readonly writeSnapshot: <A, I, RD, RE>(
      schema: Schema.Codec<A, I, RD, RE>,
      snapshot: A
    ) => Effect.Effect<void, PersistenceError.Failure, RE>
    readonly loadSnapshot: <A, I, RD, RE>(
      schema: Schema.Codec<A, I, RD, RE>
    ) => Effect.Effect<Option.Option<A>, PersistenceError.Failure, RD>
    readonly loadTrialLog: <A, I, RD, RE>(
      schema: Schema.Codec<A, I, RD, RE>
    ) => Effect.Effect<ReadonlyArray<A>, PersistenceError.Failure, RD>
  }
>()("@scenesystems/effect-study/StudyStorage") {}

/** Generic study storage implementation. @since 0.1.0 @category services */
export type Service = StudyStorage["Service"]

const codecFailure =
  (operation: PersistenceError.Failure["operation"], path: string) =>
  (cause: Schema.SchemaError): PersistenceError.Failure =>
    new PersistenceError.Failure({
      reason: "Codec",
      operation,
      path,
      detail: cause.message
    })

const encodeRecord = <A, I, RD, RE>(
  path: string,
  tag: PersistedRecord["_tag"],
  schema: Schema.Codec<A, I, RD, RE>,
  value: A
): Effect.Effect<PersistedRecord, PersistenceError.Failure, RE> =>
  Schema.encodeEffect(schema)(value).pipe(
    Effect.mapError(codecFailure("write", path)),
    Effect.map((payload) => ({ _tag: tag, payload }))
  )

const decodeRecord = <A, I, RD, RE>(
  path: string,
  schema: Schema.Codec<A, I, RD, RE>,
  record: PersistedRecord
): Effect.Effect<A, PersistenceError.Failure, RD> =>
  Schema.decodeUnknownEffect(schema)(record.payload).pipe(Effect.mapError(codecFailure("read", path)))

const service = (
  path: string,
  append: (record: PersistedRecord) => Effect.Effect<void, PersistenceError.Failure>,
  load: Effect.Effect<ReadonlyArray<PersistedRecord>, PersistenceError.Failure>
): Service => ({
  appendTrial: <A, I, RD, RE>(
    schema: Schema.Codec<A, I, RD, RE>,
    trial: A
  ): Effect.Effect<void, PersistenceError.Failure, RE> =>
    encodeRecord(path, "Trial", schema, trial).pipe(Effect.flatMap(append)),
  writeSnapshot: <A, I, RD, RE>(
    schema: Schema.Codec<A, I, RD, RE>,
    snapshot: A
  ): Effect.Effect<void, PersistenceError.Failure, RE> =>
    encodeRecord(path, "Snapshot", schema, snapshot).pipe(Effect.flatMap(append)),
  loadSnapshot: <A, I, RD, RE>(
    schema: Schema.Codec<A, I, RD, RE>
  ): Effect.Effect<Option.Option<A>, PersistenceError.Failure, RD> =>
    load.pipe(
      Effect.map((records) => Arr.findLast(records, (record) => Str.Equivalence(record._tag, "Snapshot"))),
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.succeed(Option.none<A>()),
          onSome: (record) => decodeRecord(path, schema, record).pipe(Effect.asSome)
        })
      )
    ),
  loadTrialLog: <A, I, RD, RE>(
    schema: Schema.Codec<A, I, RD, RE>
  ): Effect.Effect<ReadonlyArray<A>, PersistenceError.Failure, RD> =>
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
export const makeMemory: Effect.Effect<Service> = Ref.make(Arr.empty<PersistedRecord>()).pipe(
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
export const layerMemory: Layer.Layer<StudyStorage> = Layer.fresh(Layer.effect(StudyStorage, makeMemory))

/**
 * Creates generic persistence over one append-only JSON-lines journal.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeFileSystem = (
  options: FileSystemOptions
): Effect.Effect<Service, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Journal.make(PersistedRecord, options.directory, options.fileName).pipe(
    Effect.mapError(PersistenceError.fromJournal),
    Effect.map((journal) =>
      service(
        journal.path,
        (record) => journal.append(record).pipe(Effect.mapError(PersistenceError.fromJournal)),
        journal.read.pipe(Stream.runCollect, Effect.mapError(PersistenceError.fromJournal))
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
): Layer.Layer<StudyStorage, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(StudyStorage, makeFileSystem(options))

/** Installs an existing generic study storage service. @since 0.1.0 @category layers */
export const layer = (storage: Service): Layer.Layer<StudyStorage> => Layer.succeed(StudyStorage, storage)

/** Appends a trial through ambient generic storage. @since 0.1.0 @category operations */
export const appendTrial = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  trial: A
): Effect.Effect<void, PersistenceError.Failure, StudyStorage | RE> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.appendTrial(schema, trial)))

/** Writes a snapshot through ambient generic storage. @since 0.1.0 @category operations */
export const writeSnapshot = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  snapshot: A
): Effect.Effect<void, PersistenceError.Failure, StudyStorage | RE> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.writeSnapshot(schema, snapshot)))

/** Loads the latest snapshot through ambient generic storage. @since 0.1.0 @category operations */
export const loadSnapshot = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>
): Effect.Effect<Option.Option<A>, PersistenceError.Failure, StudyStorage | RD> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.loadSnapshot(schema)))

/** Loads the complete trial log through ambient generic storage. @since 0.1.0 @category operations */
export const loadTrialLog = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>
): Effect.Effect<ReadonlyArray<A>, PersistenceError.Failure, StudyStorage | RD> =>
  StudyStorage.pipe(Effect.flatMap((storage) => storage.loadTrialLog(schema)))

/** A committed event's identity and one-based run-local position. @since 0.1.0 @category schemas */
export const Receipt = Schema.Struct({
  runId: Schema.NonEmptyString,
  recordId: Schema.NonEmptyString,
  cursor: Schema.Int.check(Schema.isGreaterThan(0))
}).annotate({ identifier: "@scenesystems/effect-study/StudyStorage/Receipt" })

/** Committed identity, independent of append request retries. @since 0.1.0 @category models */
export type Receipt = typeof Receipt.Type

/** A decoded event and its committed receipt. @since 0.1.0 @category models */
export class StoredEvent<A> extends Data.Class<{ readonly receipt: Receipt; readonly event: A }> {}

/** A checkpoint bound to one definition and exact committed boundary. @since 0.1.0 @category models */
export class Checkpoint<A> extends Data.Class<{
  readonly runId: string
  readonly definitionDigest: string
  readonly through: number
  readonly state: A
}> {}

/** Schema-owned opening options; definition identity is supplied, never inferred from code. @since 0.1.0 @category models */
export class OpenOptions<Events extends Schema.Constraint, State extends Schema.Constraint> extends Data.Class<{
  readonly runId: string
  readonly definitionDigest: string
  readonly eventSchema: Events
  readonly checkpointSchema: State
}> {}

/** Stable append identity and optimistic expected tail cursor (zero for an empty run). @since 0.1.0 @category models */
export class Append<A> extends Data.Class<{
  readonly recordId: string
  readonly expectedCursor: number
  readonly event: A
}> {}

/** State reduced through a committed event cursor (zero for the initial state). @since 0.1.0 @category models */
export class CheckpointWrite<A> extends Data.Class<{ readonly through: number; readonly state: A }> {}

/** Read events strictly after this cursor. @since 0.1.0 @category schemas */
export const ReadOptions = Schema.Struct({ after: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))) })
  .annotate({ identifier: "@scenesystems/effect-study/StudyStorage/ReadOptions" })

/**
 * Run-bound recording. Writes require only encoding services; reads only decoding
 * services. An identical encoded retry returns its original receipt before cursor
 * validation. Reads are finite snapshots, not live subscriptions.
 * @since 0.1.0
 * @category models
 */
export class Recording<Events extends Schema.Constraint, State extends Schema.Constraint> extends Data.Class<{
  readonly append: (
    request: ConstructorParameters<typeof Append<Events["Type"]>>[0]
  ) => Effect.Effect<Receipt, PersistenceError.Failure, Events["EncodingServices"]>
  readonly read: (
    options?: typeof ReadOptions.Type
  ) => Stream.Stream<StoredEvent<Events["Type"]>, PersistenceError.Failure, Events["DecodingServices"]>
  readonly writeCheckpoint: (
    request: ConstructorParameters<typeof CheckpointWrite<State["Type"]>>[0]
  ) => Effect.Effect<void, PersistenceError.Failure, State["EncodingServices"]>
  readonly loadCheckpoint: Effect.Effect<
    Option.Option<Checkpoint<State["Type"]>>,
    PersistenceError.Failure,
    State["DecodingServices"]
  >
}> {}

/** Independently usable run recordings, separate from legacy trial/snapshot storage. @since 0.1.0 @category services */
export class Recordings extends Context.Service<Recordings, {
  readonly open: <Events extends Schema.Constraint, State extends Schema.Constraint>(
    options: ConstructorParameters<typeof OpenOptions<Events, State>>[0]
  ) => Effect.Effect<Recording<Events, State>, PersistenceError.Failure>
}>()("@scenesystems/effect-study/StudyStorage/Recordings") {}

/** Allocates isolated, schema-encoded in-memory recordings. @since 0.1.0 @category constructors */
export const makeMemoryRecordings: Effect.Effect<Recordings["Service"]> = recording.makeMemory

/**
 * Opens a strict append-only recording file. Use exactly one owning store per file;
 * its semaphore is not a cross-process lock. Acknowledgment means the platform
 * append returned for a complete newline-terminated record, not fsync or power-loss
 * durability. Damaged files fail without repair, truncation, or further appends.
 * @since 0.1.0
 * @category constructors
 */
export const makeFileSystemRecordings = fileSystemRecording.makeFileSystem

/** Opens or validates a run through the ambient recording store. @since 0.1.0 @category operations */
export const open = <Events extends Schema.Constraint, State extends Schema.Constraint>(
  options: ConstructorParameters<typeof OpenOptions<Events, State>>[0]
) => Recordings.pipe(Effect.flatMap((store) => store.open(options)))

/**
 * Reduces only the tail after the latest bound checkpoint, or the full log when
 * absent. Returns state and the exact consumed cursor, suitable for writeCheckpoint.
 * The reducer must be pure; replay never invokes an evaluator or authorizes retrying
 * external work. The caller owns checkpoint state correctness and definition versions.
 * @since 0.1.0
 * @category operations
 */
export const replay = <Events extends Schema.Constraint, State extends Schema.Constraint>(
  self: Recording<Events, State>,
  initial: State["Type"],
  reduce: (state: State["Type"], event: Events["Type"]) => State["Type"]
): Effect.Effect<
  CheckpointWrite<State["Type"]>,
  PersistenceError.Failure,
  Events["DecodingServices"] | State["DecodingServices"]
> =>
  Effect.gen(function*() {
    const checkpoint = yield* self.loadCheckpoint
    const start = Option.match(checkpoint, {
      onNone: () => new CheckpointWrite({ through: 0, state: initial }),
      onSome: (entry) => new CheckpointWrite({ through: entry.through, state: entry.state })
    })
    return yield* self.read({ after: start.through }).pipe(Stream.runFold(
      () => start,
      (previous, entry) =>
        new CheckpointWrite({ through: entry.receipt.cursor, state: reduce(previous.state, entry.event) })
    ))
  })
