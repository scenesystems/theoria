import { expect, it } from "@effect/vitest"
import * as Journal from "@scenesystems/effect-study/Journal"
import { Chunk, Effect, Either, Option, Ref } from "effect"

import { EventPublisher, EventRuntime } from "../../src/internal/optimization/events.js"
import { makeStopRef, requestOptimizationStop } from "../../src/internal/optimization/runtime/controls.js"
import type * as OptimizationEvent from "../../src/OptimizationEvent.js"

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
    const events = yield* Ref.make(Chunk.empty<OptimizationEvent.OptimizationEvent>())
    const runtime = yield* makeRuntime(
      new EventPublisher({
        publish: (event) => Ref.update(events, Chunk.append(event))
      })
    )
    const stopRef = yield* makeStopRef

    yield* requestOptimizationStop(runtime, stopRef, "Interrupt", 1, "done")
    yield* requestOptimizationStop(runtime, stopRef, "Interrupt", 1, "done")

    const published = yield* Ref.get(events)
    expect(Chunk.size(published)).toBe(1)
    expect(Chunk.head(published).pipe(Option.map((event) => event._tag))).toEqual(
      Option.some("StopRequested")
    )
  }))

it.effect("preserves typed publication errors at the search boundary", () =>
  Effect.gen(function*() {
    const failure = new Journal.Failure({
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

    const result = yield* requestOptimizationStop(runtime, stopRef, "Drain", 2, "persist").pipe(Effect.either)

    expect(result).toEqual(Either.left(failure))
  }))
