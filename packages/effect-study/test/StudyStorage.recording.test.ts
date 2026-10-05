import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Result, Schema, Stream } from "effect"

import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { conformance } from "./fixtures/recording.js"

describe("memory recording", () => conformance(StudyStorage.makeMemory))

const options = (runId: string, definitionDigest = "definition-v1") =>
  new StudyStorage.OpenOptions({
    runId,
    definitionDigest,
    eventSchema: Schema.String,
    checkpointSchema: Schema.Int
  })

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
