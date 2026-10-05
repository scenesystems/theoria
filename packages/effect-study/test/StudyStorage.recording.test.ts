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

it.effect("isolates runs and returns the original receipt after a lost acknowledgment", () =>
  Effect.gen(function*() {
    const store = yield* StudyStorage.makeMemoryRecordings
    const first = yield* store.open(options("first"))
    const second = yield* store.open(options("second"))
    const receipt = yield* first.append({ recordId: "request-1", expectedCursor: 0, event: "alpha" })
    yield* first.append({ recordId: "request-2", expectedCursor: 1, event: "beta" })
    expect(yield* first.append({ recordId: "request-1", expectedCursor: 0, event: "alpha" })).toEqual(receipt)
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
    const store = yield* StudyStorage.makeMemoryRecordings
    const run = yield* store.open(options("run"))
    yield* run.append({ recordId: "one", expectedCursor: 0, event: "first" })
    const conflict = yield* run.append({ recordId: "one", expectedCursor: 0, event: "different" }).pipe(Effect.result)
    expect((yield* Effect.fromResult(Result.flip(conflict))).reason).toBe("RecordConflict")
    const raced = yield* Effect.all(
      Arr.map(
        Arr.make("two", "three"),
        (recordId) => run.append({ recordId, expectedCursor: 1, event: recordId }).pipe(Effect.result)
      ),
      { concurrency: 2 }
    )
    expect(Arr.filter(raced, Result.isSuccess)).toHaveLength(1)
    expect(Arr.map(Arr.filter(raced, Result.isFailure), (result) => result.failure.reason)).toEqual(["CursorConflict"])
    const incompatible = yield* store.open(options("run", "different-definition")).pipe(Effect.result)
    expect((yield* Effect.fromResult(Result.flip(incompatible))).reason).toBe("Incompatible")
    expect(yield* run.read().pipe(Stream.runCollect)).toHaveLength(2)
  }))
