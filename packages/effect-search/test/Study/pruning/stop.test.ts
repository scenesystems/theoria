import { expect, it } from "@effect/vitest"
import { Chunk, Effect, Either, Option, Ref } from "effect"

import { ArtifactStorageError } from "../../../src/Errors/index.js"
import { EventPublisher, EventRuntime } from "../../../src/Study/events.js"
import { makeStopRef, requestStudyStop } from "../../../src/Study/runtime/controls.js"
import type * as StudyEvent from "../../../src/StudyEvent/index.js"

const makeRuntime = (eventPublisher: EventPublisher): Effect.Effect<EventRuntime> =>
  Effect.all({
    bestValueRef: Ref.make(Option.none<number>()),
    noImprovementCountRef: Ref.make(0)
  }).pipe(
    Effect.map(({ bestValueRef, noImprovementCountRef }) =>
      new EventRuntime({ bestValueRef, noImprovementCountRef, eventPublisher })
    )
  )

it.effect("does not publish a duplicate selected stop request", () =>
  Effect.gen(function*() {
    const events = yield* Ref.make(Chunk.empty<StudyEvent.StudyEvent>())
    const runtime = yield* makeRuntime(
      new EventPublisher({
        publish: (event) => Ref.update(events, Chunk.append(event))
      })
    )
    const stopRef = yield* makeStopRef

    yield* requestStudyStop(runtime, stopRef, "Interrupt", 1, "done")
    yield* requestStudyStop(runtime, stopRef, "Interrupt", 1, "done")

    const published = yield* Ref.get(events)
    expect(Chunk.size(published)).toBe(1)
    expect(Chunk.head(published).pipe(Option.map((event) => event._tag))).toEqual(
      Option.some("StudyStopRequested")
    )
  }))

it.effect("preserves typed publication errors at the search boundary", () =>
  Effect.gen(function*() {
    const failure = new ArtifactStorageError({
      operation: "write",
      path: "events.jsonl",
      detail: "rejected"
    })
    const runtime = yield* makeRuntime(
      new EventPublisher({
        publish: () => Effect.fail(failure)
      })
    )
    const stopRef = yield* makeStopRef

    const result = yield* requestStudyStop(runtime, stopRef, "Drain", 2, "persist").pipe(Effect.either)

    expect(result).toEqual(Either.left(failure))
  }))
