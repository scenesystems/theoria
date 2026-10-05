/**
 * Run-bound event recordings and cursor-bound checkpoints.
 *
 * @since 0.1.0
 * @module
 */
import { Context, Data, Effect, type FileSystem, Layer, Option, Path, Schema, Stream } from "effect"

import * as fileSystemRecording from "./internal/fileSystemRecording.js"
import * as recording from "./internal/recording.js"
import type * as PersistenceError from "./PersistenceError.js"

const defaultFileName = "study-storage.jsonl"

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
 * Opens run-bound recordings through caller-owned event and checkpoint schemas.
 * Codec requirements remain on each operation.
 *
 * @since 0.1.0
 * @category services
 */
export class StudyStorage extends Context.Service<
  StudyStorage,
  {
    readonly open: <Events extends Schema.Constraint, State extends Schema.Constraint>(
      options: OpenOptions<Events, State>
    ) => Effect.Effect<Recording<Events, State>, PersistenceError.Failure>
  }
>()("@scenesystems/effect-study/StudyStorage") {}

/** Generic study storage implementation. @since 0.1.0 @category services */
export type Service = StudyStorage["Service"]

/**
 * Creates isolated in-memory run-bound recording persistence.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeMemory: Effect.Effect<Service> = recording.makeMemory.pipe(Effect.map((open) => ({ open })))

/**
 * Provides isolated in-memory recordings.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerMemory: Layer.Layer<StudyStorage> = Layer.fresh(Layer.effect(StudyStorage, makeMemory))

/**
 * Creates strict run recordings at the configured file. Use one owning service per location; its
 * semaphore is not a cross-process lock. Recording acknowledgment means a complete
 * newline-terminated append returned, not fsync or power-loss durability. Damaged
 * recordings fail without repair, truncation, or further appends.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeFileSystem = (
  options: FileSystemOptions
): Effect.Effect<Service, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    return { open: yield* fileSystemRecording.makeFileSystem(path.join(options.directory, options.fileName)) }
  })

/**
 * Provides filesystem-backed run recordings.
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

/**
 * Structural opening options carrying caller codecs and explicit definition identity.
 * Construct with new OpenOptions({...}); open requires an instance, including its
 * Effect Data pipe method, rather than a plain object.
 * @since 0.1.0
 * @category models
 */
export class OpenOptions<Events extends Schema.Constraint, State extends Schema.Constraint> extends Data.Class<{
  readonly runId: string
  readonly definitionDigest: string
  readonly eventSchema: Events
  readonly checkpointSchema: State
}> {}

/**
 * Stable append identity and optimistic expected tail cursor (zero for an empty run).
 * Construct with new Append({...}); append requires this Data instance.
 * @since 0.1.0
 * @category models
 */
export class Append<A> extends Data.Class<{
  readonly recordId: string
  readonly expectedCursor: number
  readonly event: A
}> {}

/**
 * State reduced through a committed event cursor (zero for the initial state).
 * Construct with new CheckpointWrite({...}), or use replay's returned instance.
 * writeCheckpoint requires this Data instance, not a plain object.
 * @since 0.1.0
 * @category models
 */
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
    request: Append<Events["Type"]>
  ) => Effect.Effect<Receipt, PersistenceError.Failure, Events["EncodingServices"]>
  readonly read: (
    options?: typeof ReadOptions.Type
  ) => Stream.Stream<StoredEvent<Events["Type"]>, PersistenceError.Failure, Events["DecodingServices"]>
  readonly writeCheckpoint: (
    request: CheckpointWrite<State["Type"]>
  ) => Effect.Effect<void, PersistenceError.Failure, State["EncodingServices"]>
  readonly loadCheckpoint: Effect.Effect<
    Option.Option<Checkpoint<State["Type"]>>,
    PersistenceError.Failure,
    State["DecodingServices"]
  >
}> {}

/** Opens or validates a run through the ambient recording store. @since 0.1.0 @category operations */
export const open = <Events extends Schema.Constraint, State extends Schema.Constraint>(
  options: OpenOptions<Events, State>
) => StudyStorage.pipe(Effect.flatMap((store) => store.open(options)))

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
