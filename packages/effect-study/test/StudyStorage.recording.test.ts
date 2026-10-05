import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Result, Schema, Stream } from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const options = (runId: string, definitionDigest = "definition-v1") =>
  new StudyStorage.OpenOptions({
    runId,
    definitionDigest,
    eventSchema: Schema.String,
    checkpointSchema: Schema.Int
  })

it.effect("isolates runs and returns the original receipt for an identical retry after later appends", () =>
  Effect.gen(function*() {
    const store = yield* StudyStorage.makeMemory
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

it.effect("reports memory payload codec failures without filesystem diagnostics", () =>
  Effect.gen(function*() {
    const store = yield* StudyStorage.makeMemory
    const run = yield* store.open(options("run"))
    yield* run.append(new StudyStorage.Append({ recordId: "one", expectedCursor: 0, event: "value" }))
    yield* run.writeCheckpoint(new StudyStorage.CheckpointWrite({ through: 1, state: 7 }))
    const reader = yield* store.open(
      new StudyStorage.OpenOptions({
        runId: "run",
        definitionDigest: "definition-v1",
        eventSchema: Schema.Int,
        checkpointSchema: Schema.String
      })
    )
    const event = yield* Effect.fromResult(Result.flip(yield* reader.read().pipe(Stream.runCollect, Effect.result)))
    const checkpoint = yield* Effect.fromResult(Result.flip(yield* reader.loadCheckpoint.pipe(Effect.result)))
    yield* Effect.forEach([event, checkpoint], (failure) =>
      Effect.gen(function*() {
        expect(failure.reason).toBe("Codec")
        expect(failure.operation).toBe("read")
        expect(Option.fromNullishOr(failure.path)).toEqual(Option.none())
        expect(Option.fromNullishOr(failure.line)).toEqual(Option.none())
      }))
  }))

it.effect("rejects conflicting identities before stale cursors and admits only one racing append", () =>
  Effect.gen(function*() {
    const store = yield* StudyStorage.makeMemory
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
    expect(Arr.map(Arr.filter(raced, Result.isFailure), (result) => result.failure.reason)).toEqual(["CursorConflict"])
    const incompatible = yield* store.open(options("run", "different-definition")).pipe(Effect.result)
    expect((yield* Effect.fromResult(Result.flip(incompatible))).reason).toBe("Incompatible")
    expect(yield* run.read().pipe(Stream.runCollect)).toHaveLength(2)
  }))
