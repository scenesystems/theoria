import { expect, it } from "@effect/vitest"
import {
  Arbitrary,
  Array as Arr,
  Context,
  Deferred,
  Effect,
  Fiber,
  Number as Num,
  Option,
  Result,
  Schema,
  SchemaGetter,
  type Scope,
  Stream,
  String as Str
} from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const options = (runId: string, definitionDigest = "definition-v1") =>
  new StudyStorage.OpenOptions({ runId, definitionDigest, eventSchema: Schema.String, checkpointSchema: Schema.Int })
const integers = new StudyStorage.OpenOptions({
  runId: "run",
  definitionDigest: "definition",
  eventSchema: Schema.Int,
  checkpointSchema: Schema.Array(Schema.Int)
})
const numberText = Schema.encodeSync(Schema.FiniteFromString)
class Encode extends Context.Service<Encode, string>()("effect-study/test/conformance/Encode") {}
class Decode extends Context.Service<Decode, string>()("effect-study/test/conformance/Decode") {}
const Label = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((value) => Decode.pipe(Effect.as(Str.toLowerCase(value)))),
  encode: SchemaGetter.transformEffect((value) => Encode.pipe(Effect.as(Str.toUpperCase(value))))
}))

// Each test acquires a fresh backend. This suite concerns the recording protocol,
// not backend durability, corruption diagnostics, or transaction implementation.
export const conformance = <E>(make: Effect.Effect<StudyStorage.Service, E, Scope.Scope>) => {
  it.effect("isolates runs and returns the original receipt for an identical retry after later appends", () =>
    Effect.gen(function*() {
      const store = yield* make
      const first = yield* store.open(options("first"))
      const second = yield* store.open(options("second"))
      const receipt = yield* first.append(
        new StudyStorage.Append({ recordId: "request-1", expectedCursor: 0, event: "alpha" })
      )
      yield* first.append(new StudyStorage.Append({ recordId: "request-2", expectedCursor: 1, event: "beta" }))
      expect(yield* first.append(new StudyStorage.Append({ recordId: "request-1", expectedCursor: 0, event: "alpha" })))
        .toEqual(receipt)
      expect(receipt).toEqual({ runId: "first", recordId: "request-1", cursor: 1 })
      expect(yield* second.read().pipe(Stream.runCollect)).toEqual([])
      const reopened = yield* store.open(options("first"))
      expect(Arr.map(yield* reopened.read({ after: 1 }).pipe(Stream.runCollect), (entry) => entry.event)).toEqual([
        "beta"
      ])
      expect(yield* reopened.loadCheckpoint).toEqual(Option.none())
    }))

  it.effect("rejects conflicting identities before stale cursors and admits only one racing append", () =>
    Effect.gen(function*() {
      const store = yield* make
      const run = yield* store.open(options("run"))
      yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "first" }))
      const conflict = yield* run.append(
        new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "different" })
      ).pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(conflict))).reason).toBe("RecordConflict")
      const raced = yield* Effect.all(
        Arr.map(
          Arr.make("two", "three"),
          (recordId) =>
            run.append(new StudyStorage.Append({ recordId, expectedCursor: 1, event: recordId })).pipe(Effect.result)
        ),
        { concurrency: 2 }
      )
      expect(Arr.filter(raced, Result.isSuccess)).toHaveLength(1)
      expect(Arr.map(Arr.filter(raced, Result.isFailure), (result) => result.failure.reason)).toEqual([
        "CursorConflict"
      ])
      const incompatible = yield* store.open(options("run", "different-definition")).pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(incompatible))).reason).toBe("Incompatible")
      expect(yield* run.read().pipe(Stream.runCollect)).toHaveLength(2)
    }))

  it.effect("compares exact schema-produced JSON rather than semantic object equality", () =>
    Effect.gen(function*() {
      const schema = Schema.Record(Schema.String, Schema.Int)
      const first = { left: 1, right: 2 }
      const reordered = { right: 2, left: 1 }
      const encode = Schema.encodeEffect(Schema.fromJsonString(schema))
      expect(first).toEqual(reordered)
      expect(yield* encode(first)).toBe("{\"left\":1,\"right\":2}")
      expect(yield* encode(reordered)).toBe("{\"right\":2,\"left\":1}")
      const run = yield* (yield* make).open(
        new StudyStorage.OpenOptions({
          runId: "run",
          definitionDigest: "record-order",
          eventSchema: schema,
          checkpointSchema: Schema.Int
        })
      )
      yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: first }))
      const conflict = yield* run.append(
        new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: reordered })
      ).pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(conflict))).reason).toBe("RecordConflict")
      expect(yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: first })))
        .toEqual({ runId: "run", recordId: "one", cursor: 1 })
    }))

  it.effect("reads a finite ordered snapshot while another append completes", () =>
    Effect.gen(function*() {
      const run = yield* (yield* make).open(integers)
      yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: 7 }))
      yield* run.append(new StudyStorage.Append({ recordId: "two", expectedCursor: 1, event: -3 }))
      const reading = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const snapshot = yield* run.read().pipe(
        Stream.tap(() => Deferred.succeed(reading, undefined).pipe(Effect.andThen(Deferred.await(release)))),
        Stream.runCollect,
        Effect.forkChild
      )
      yield* Deferred.await(reading)
      yield* run.append(new StudyStorage.Append({ recordId: "three", expectedCursor: 2, event: 11 }))
      yield* Deferred.succeed(release, undefined)
      expect(Arr.map(yield* Fiber.join(snapshot), (entry) => entry.event)).toEqual([7, -3])
      expect(Arr.map(yield* run.read().pipe(Stream.runCollect), (entry) => entry.event)).toEqual([7, -3, 11])
    }))

  it.effect("preserves codec channels, normalized retry identity, and codec failures", () =>
    Effect.gen(function*() {
      const store = yield* make
      const run = yield* store.open(
        new StudyStorage.OpenOptions({
          runId: "run",
          definitionDigest: "label",
          eventSchema: Label,
          checkpointSchema: Label
        })
      )
      yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "hello" }))
        .pipe(Effect.provideService(Encode, "encode"))
      expect(
        yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "HELLO" }))
          .pipe(Effect.provideService(Encode, "encode"))
      ).toEqual({ runId: "run", recordId: "one", cursor: 1 })
      yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: "state" }))
        .pipe(Effect.provideService(Encode, "encode"))
      expect(Arr.map(yield* run.read().pipe(Stream.runCollect, Effect.provideService(Decode, "decode")), (entry) =>
        entry.event)).toEqual(["hello"])
      expect(Option.map(yield* run.loadCheckpoint.pipe(Effect.provideService(Decode, "decode")), (entry) =>
        entry.state)).toEqual(Option.some("state"))
      const reader = yield* store.open(
        new StudyStorage.OpenOptions({
          runId: "run",
          definitionDigest: "label",
          eventSchema: Schema.Int,
          checkpointSchema: Schema.Int
        })
      )
      const badEvent = yield* reader.read().pipe(Stream.runCollect, Effect.result)
      const badState = yield* reader.loadCheckpoint.pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(badEvent))).reason).toBe("Codec")
      expect((yield* Effect.fromResult(Result.flip(badState))).reason).toBe("Codec")
      const badWrite = yield* reader.append(new StudyStorage.Append({ recordId: "two", expectedCursor: 1, event: 1.5 }))
        .pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(badWrite))).reason).toBe("Codec")
      const badCheckpoint = yield* reader.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: 1.5 }))
        .pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(badCheckpoint))).reason).toBe("Codec")
    }))

  it.effect("uses the latest written checkpoint even when its boundary is lower", () =>
    Effect.gen(function*() {
      const run = yield* (yield* make).open(integers)
      yield* Effect.forEach([7, -3, 11], (event, index) =>
        run.append(new StudyStorage.Append({ recordId: numberText(index), expectedCursor: index, event })))
      yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 3, state: [7, -3, 11] }))
      const loaded = yield* Effect.fromOption(yield* run.loadCheckpoint)
      yield* run.append(new StudyStorage.Append({ recordId: "later", expectedCursor: 3, event: 5 }))
      yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: [7] }))
      const retainedTail = yield* run.read({ after: loaded.through }).pipe(Stream.runCollect)
      expect(Arr.appendAll(
        loaded.state,
        Arr.map(retainedTail, (entry) =>
          entry.event)
      )).toEqual([7, -3, 11, 5])
      expect(Option.map(yield* run.loadCheckpoint, (checkpoint) =>
        checkpoint.through)).toEqual(Option.some(1))
      expect(yield* StudyStorage.replay(run, Arr.empty<number>(), Arr.append)).toEqual(
        new StudyStorage.CheckpointWrite({ through: 4, state: [7, -3, 11, 5] })
      )
    }))

  it.effect.prop("checkpoint plus tail equals the full ordered log despite repeated append delivery", {
    values: Arbitrary.array(Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: -100, maximum: 100 }))), {
      maxLength: 12
    }),
    split: Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 12 })))
  }, ({ values, split }) =>
    Effect.gen(function*() {
      const run = yield* (yield* make).open(integers)
      yield* Effect.forEach(values, (event, index) =>
        run.append(new StudyStorage.Append({ recordId: numberText(index), expectedCursor: index, event })))
      yield* Effect.forEach(values, (event, index) =>
        run.append(new StudyStorage.Append({ recordId: numberText(index), expectedCursor: index, event })))
      const full = yield* StudyStorage.replay(run, Arr.empty<number>(), Arr.append)
      expect(full.state).toEqual(values)
      expect(full.through).toBe(Arr.length(values))
      const through = Num.min(split, Arr.length(values))
      yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through, state: Arr.take(values, through) }))
      expect(yield* StudyStorage.replay(run, Arr.empty<number>(), Arr.append)).toEqual(full)
    }))
}
