/** Run-bound recording protocol shared by memory and filesystem adapters. @since 0.1.0 */
import {
  Array as Arr,
  Data,
  Effect,
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
export const Wire = Schema.Union([
  Schema.TaggedStruct("Opened", Identity.fields),
  Schema.TaggedStruct("Event", {
    ...Identity.fields,
    recordId: Schema.NonEmptyString,
    cursor: Cursor,
    payload: Schema.String
  }),
  Schema.TaggedStruct("Checkpoint", { ...Identity.fields, through: Cursor, payload: Schema.String })
])

/** Serialized backend operations shared by every handle from one store. @since 0.1.0 @category models */
export class Backend extends Data.Class<{
  readonly lock: Semaphore.Semaphore
  readonly read: Effect.Effect<ReadonlyArray<typeof Wire.Type>, PersistenceError.Failure>
  readonly append: (record: typeof Wire.Type) => Effect.Effect<void, PersistenceError.Failure>
}> {}

const failure = (reason: PersistenceError.Failure["reason"], operation: "read" | "write", detail: string) =>
  new PersistenceError.Failure({ reason, operation, detail })

/** Binds caller codecs to a backend without erasing codec service requirements. @since 0.1.0 @category constructors */
export const make = (backend: Backend): Storage.Recordings["Service"] => ({
  open: <Events extends Schema.Constraint, State extends Schema.Constraint>(
    options: ConstructorParameters<typeof Storage.OpenOptions<Events, State>>[0]
  ) =>
    backend.lock.withPermit(Effect.gen(function*() {
      const identity = yield* Schema.decodeEffect(Identity)(options).pipe(
        Effect.mapError(PersistenceError.codec("write"))
      )
      const forRun = backend.read.pipe(
        Effect.map(Arr.filter((record) => Str.Equivalence(record.runId, identity.runId)))
      )
      const existing = yield* forRun
      if (Arr.some(existing, (record) => !Str.Equivalence(record.definitionDigest, identity.definitionDigest))) {
        return yield* failure("Incompatible", "read", "Recording definition differs from the requested definition")
      }
      if (Arr.isReadonlyArrayEmpty(existing)) yield* backend.append({ _tag: "Opened", ...identity })
      const events = forRun.pipe(Effect.map(Arr.filter((record) => record._tag === "Event")))
      const checkpoint = forRun.pipe(Effect.map(Arr.findLast((record) => record._tag === "Checkpoint")))
      const eventCodec = Schema.fromJsonString(options.eventSchema)
      const stateCodec = Schema.fromJsonString(options.checkpointSchema)
      return new Storage.Recording<Events, State>({
        append: (request) =>
          backend.lock.withPermit(Effect.gen(function*() {
            yield* Schema.decodeEffect(AppendMetadata)(request).pipe(Effect.mapError(PersistenceError.codec("write")))
            const payload = yield* Schema.encodeEffect(eventCodec)(request.event).pipe(
              Effect.mapError(PersistenceError.codec("write"))
            )
            const records = yield* events
            const duplicate = Arr.findFirst(records, (record) => Str.Equivalence(record.recordId, request.recordId))
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
            if (!Num.Equivalence(request.expectedCursor, Arr.length(records))) {
              return yield* failure("CursorConflict", "write", "Expected cursor is not the committed tail")
            }
            const receipt = {
              runId: identity.runId,
              recordId: request.recordId,
              cursor: Num.increment(Arr.length(records))
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
            const records = yield* backend.lock.withPermit(events)
            if (Num.isGreaterThan(after, Arr.length(records))) {
              return yield* failure("CursorConflict", "read", "Read cursor is beyond the committed tail")
            }
            return Stream.fromIterable(Arr.filter(records, (record) => Num.isGreaterThan(record.cursor, after))).pipe(
              Stream.mapEffect((record) =>
                Schema.decodeEffect(eventCodec)(record.payload).pipe(
                  Effect.mapError(PersistenceError.codec("read")),
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
            const records = yield* events
            if (Num.isGreaterThan(through, Arr.length(records))) {
              return yield* failure("Incompatible", "write", "Checkpoint is beyond the committed tail")
            }
            const payload = yield* Schema.encodeEffect(stateCodec)(request.state).pipe(
              Effect.mapError(PersistenceError.codec("write"))
            )
            yield* backend.append({ _tag: "Checkpoint", ...identity, through, payload })
          })),
        loadCheckpoint: backend.lock.withPermit(checkpoint).pipe(Effect.flatMap(Option.match({
          onNone: () => Effect.succeedNone,
          onSome: (record) =>
            Schema.decodeEffect(stateCodec)(record.payload).pipe(
              Effect.mapError(PersistenceError.codec("read")),
              Effect.map((state) =>
                Option.some(new Storage.Checkpoint({ ...identity, through: record.through, state }))
              )
            )
        })))
      })
    }))
})

/** Allocates a new encoded memory backend per execution. @since 0.1.0 @category constructors */
export const makeMemory: Effect.Effect<Storage.Recordings["Service"]> = Effect.gen(function*() {
  const records = yield* Ref.make(Arr.empty<typeof Wire.Type>())
  return make(
    new Backend({
      lock: yield* Semaphore.make(1),
      read: Ref.get(records),
      append: (record) => Ref.update(records, Arr.append(record))
    })
  )
})
