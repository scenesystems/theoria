/** Run-bound recording protocol shared by memory and filesystem adapters. @since 0.1.0 */
import {
  Chunk,
  Data,
  Effect,
  HashMap,
  Number as Num,
  Option,
  Ref,
  Schema,
  Semaphore,
  Stream,
  String as Str
} from "effect"

import * as PersistenceError from "../PersistenceError.js"
import * as Storage from "../StudyStorage.js"

const Identity = Schema.Struct({ runId: Schema.NonEmptyString, definitionDigest: Schema.NonEmptyString })
const Cursor = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const AppendMetadata = Schema.Struct({ recordId: Schema.NonEmptyString, expectedCursor: Cursor })

/** Private committed-record wire protocol. @since 0.1.0 @category schemas */
const EventRecord = Schema.TaggedStruct("Event", {
  ...Identity.fields,
  recordId: Schema.NonEmptyString,
  cursor: Cursor,
  payload: Schema.String
})
const CheckpointRecord = Schema.TaggedStruct("Checkpoint", {
  ...Identity.fields,
  through: Cursor,
  payload: Schema.String
})
export const Wire = Schema.Union([Schema.TaggedStruct("Opened", Identity.fields), EventRecord, CheckpointRecord])

const Source = Schema.Struct({ path: PersistenceError.Failure.fields.path, line: PersistenceError.Failure.fields.line })
const Event = Schema.Struct({ ...EventRecord.fields, source: Source })
const Checkpoint = Schema.Struct({ ...CheckpointRecord.fields, source: Source })
const payloadFailure = (source: typeof Source.Type) => (cause: Schema.SchemaError) =>
  new PersistenceError.Failure({ reason: "Codec", operation: "read", detail: cause.message, ...source })

/** Indexed retained run, updated once per accepted wire record. @since 0.1.0 @category models */
export class Run extends Data.Class<{
  readonly definitionDigest: string
  readonly events: Chunk.Chunk<typeof Event.Type>
  readonly identities: HashMap.HashMap<string, typeof EventRecord.Type>
  readonly checkpoint: Option.Option<typeof Checkpoint.Type>
}> {}

/** Validates and indexes one committed record without rescanning its prefix. @since 0.1.0 @category operations */
export const accept = (
  runs: HashMap.HashMap<string, Run>,
  record: typeof Wire.Type,
  source: typeof Source.Type = {}
): Effect.Effect<HashMap.HashMap<string, Run>, PersistenceError.Failure> =>
  Effect.gen(function*() {
    const existing = HashMap.get(runs, record.runId)
    if (record._tag === "Opened") {
      if (Option.isSome(existing)) return yield* failure("Incompatible", "read", "Duplicate run opening")
      return HashMap.set(
        runs,
        record.runId,
        new Run({
          definitionDigest: record.definitionDigest,
          events: Chunk.empty(),
          identities: HashMap.empty(),
          checkpoint: Option.none()
        })
      )
    }
    if (
      Option.isNone(existing) || !Str.Equivalence(existing.value.definitionDigest, record.definitionDigest)
    ) return yield* failure("Incompatible", "read", "Missing or incompatible run definition")
    const run = existing.value
    if (record._tag === "Event") {
      if (
        !Num.Equivalence(record.cursor, Num.increment(Chunk.size(run.events))) ||
        HashMap.has(run.identities, record.recordId)
      ) return yield* failure("Incompatible", "read", "Non-contiguous cursor or duplicate record identity")
      return HashMap.set(
        runs,
        record.runId,
        new Run({
          definitionDigest: run.definitionDigest,
          checkpoint: run.checkpoint,
          events: Chunk.append(run.events, { ...record, source }),
          identities: HashMap.set(run.identities, record.recordId, record)
        })
      )
    }
    if (Num.isGreaterThan(record.through, Chunk.size(run.events))) {
      return yield* failure("Incompatible", "read", "Checkpoint boundary is not committed")
    }
    return HashMap.set(
      runs,
      record.runId,
      new Run({
        definitionDigest: run.definitionDigest,
        events: run.events,
        identities: run.identities,
        checkpoint: Option.some({ ...record, source })
      })
    )
  })

/** Serialized backend operations shared by every handle from one store. @since 0.1.0 @category models */
export class Backend extends Data.Class<{
  readonly lock: Semaphore.Semaphore
  readonly read: Effect.Effect<HashMap.HashMap<string, Run>, PersistenceError.Failure>
  readonly append: (record: typeof Wire.Type) => Effect.Effect<void, PersistenceError.Failure>
}> {}

const failure = (reason: PersistenceError.Failure["reason"], operation: "read" | "write", detail: string) =>
  new PersistenceError.Failure({ reason, operation, detail })

/** Binds caller codecs to a backend without erasing codec service requirements. @since 0.1.0 @category constructors */
export const make =
  (backend: Backend): Storage.Service["open"] =>
  <Events extends Schema.Constraint, State extends Schema.Constraint>(
    options: Storage.OpenOptions<Events, State>
  ) =>
    backend.lock.withPermit(Effect.gen(function*() {
      const identity = yield* Schema.decodeEffect(Identity)(options).pipe(
        Effect.mapError(PersistenceError.codec("write"))
      )
      const existing = HashMap.get(yield* backend.read, identity.runId)
      if (Option.isSome(existing) && !Str.Equivalence(existing.value.definitionDigest, identity.definitionDigest)) {
        return yield* failure("Incompatible", "read", "Recording definition differs from the requested definition")
      }
      if (Option.isNone(existing)) yield* backend.append({ _tag: "Opened", ...identity })
      const forRun = backend.read.pipe(Effect.flatMap((runs) => {
        const run = HashMap.get(runs, identity.runId)
        return Option.isSome(run) && Str.Equivalence(run.value.definitionDigest, identity.definitionDigest)
          ? Effect.succeed(run.value)
          : Effect.fail(failure("Incompatible", "read", "Bound recording disappeared or changed definition"))
      }))
      const eventCodec = Schema.fromJsonString(options.eventSchema)
      const stateCodec = Schema.fromJsonString(options.checkpointSchema)
      return new Storage.Recording<Events, State>({
        append: (request) =>
          backend.lock.withPermit(Effect.gen(function*() {
            yield* Schema.decodeEffect(AppendMetadata)(request).pipe(Effect.mapError(PersistenceError.codec("write")))
            const payload = yield* Schema.encodeEffect(eventCodec)(request.event).pipe(
              Effect.mapError(PersistenceError.codec("write"))
            )
            const run = yield* forRun
            const duplicate = HashMap.get(run.identities, request.recordId)
            if (Option.isSome(duplicate)) {
              if (!Str.Equivalence(duplicate.value.payload, payload)) {
                return yield* failure(
                  "RecordConflict",
                  "write",
                  "Record identity already has different encoded content"
                )
              }
              return { runId: identity.runId, recordId: request.recordId, cursor: duplicate.value.cursor }
            }
            if (!Num.Equivalence(request.expectedCursor, Chunk.size(run.events))) {
              return yield* failure("CursorConflict", "write", "Expected cursor is not the committed tail")
            }
            const receipt = {
              runId: identity.runId,
              recordId: request.recordId,
              cursor: Num.increment(Chunk.size(run.events))
            }
            yield* backend.append({ _tag: "Event", ...identity, ...receipt, payload })
            return receipt
          })),
        read: (readOptions = {}) =>
          Stream.unwrap(Effect.gen(function*() {
            yield* Schema.decodeEffect(Storage.ReadOptions)(readOptions).pipe(
              Effect.mapError(PersistenceError.codec("read"))
            )
            const after = Option.getOrElse(Option.fromNullishOr(readOptions.after), () => 0)
            const run = yield* backend.lock.withPermit(forRun)
            if (Num.isGreaterThan(after, Chunk.size(run.events))) {
              return yield* failure("CursorConflict", "read", "Read cursor is beyond the committed tail")
            }
            return Stream.fromIterable(Chunk.drop(run.events, after)).pipe(
              Stream.mapEffect((record) =>
                Schema.decodeEffect(eventCodec)(record.payload).pipe(
                  Effect.mapError(payloadFailure(record.source)),
                  Effect.map((event) =>
                    new Storage.StoredEvent({
                      receipt: { runId: record.runId, recordId: record.recordId, cursor: record.cursor },
                      event
                    })
                  )
                )
              )
            )
          })),
        writeCheckpoint: (request) =>
          backend.lock.withPermit(Effect.gen(function*() {
            const through = yield* Schema.decodeEffect(Cursor)(request.through).pipe(
              Effect.mapError(PersistenceError.codec("write"))
            )
            const run = yield* forRun
            if (Num.isGreaterThan(through, Chunk.size(run.events))) {
              return yield* failure("Incompatible", "write", "Checkpoint is beyond the committed tail")
            }
            const payload = yield* Schema.encodeEffect(stateCodec)(request.state).pipe(
              Effect.mapError(PersistenceError.codec("write"))
            )
            yield* backend.append({ _tag: "Checkpoint", ...identity, through, payload })
          })),
        loadCheckpoint: backend.lock.withPermit(forRun).pipe(
          Effect.map((run) => run.checkpoint),
          Effect.flatMap(Option.match({
            onNone: () => Effect.succeedNone,
            onSome: (record) =>
              Schema.decodeEffect(stateCodec)(record.payload).pipe(
                Effect.mapError(payloadFailure(record.source)),
                Effect.map((state) =>
                  Option.some(new Storage.Checkpoint({ ...identity, through: record.through, state }))
                )
              )
          }))
        )
      })
    }))

/** Allocates a new encoded memory backend per execution. @since 0.1.0 @category constructors */
export const makeMemory: Effect.Effect<Storage.Service["open"]> = Effect.gen(function*() {
  const records = yield* Ref.make(HashMap.empty<string, Run>())
  return make(
    new Backend({
      lock: yield* Semaphore.make(1),
      read: Ref.get(records),
      append: (record) =>
        Ref.get(records).pipe(
          Effect.flatMap((runs) => accept(runs, record)),
          Effect.flatMap((runs) => Ref.set(records, runs))
        )
    })
  )
})
