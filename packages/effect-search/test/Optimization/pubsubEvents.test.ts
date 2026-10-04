import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Fiber, PubSub, Ref, Stream } from "effect"

import {
  EventPublisher,
  eventPublisherFromPubSub,
  fanoutEventPublisher
} from "../../src/internal/optimization/events.js"
import * as OptimizationEvent from "../../src/OptimizationEvent.js"

describe("pubsub event fanout", () => {
  it.effect("broadcasts events to pubsub stream and secondary sink", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const pubsub = yield* PubSub.unbounded<OptimizationEvent.OptimizationEvent>()
        const mirroredRef = yield* Ref.make(Arr.empty<OptimizationEvent.OptimizationEvent>())
        const mirroredPublisher = new EventPublisher({
          publish: (event) => Ref.update(mirroredRef, (events) => Arr.append(events, event))
        })
        const publisher = fanoutEventPublisher(eventPublisherFromPubSub(pubsub), mirroredPublisher)

        const event = OptimizationEvent.TrialStarted({ trialNumber: 1, config: { x: 0.5 } })
        const stream = Stream.fromPubSub(pubsub)
        const streamFiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.forkScoped
        )

        yield* Effect.yieldNow
        yield* publisher.publish(event)

        const fromPubSub = yield* Fiber.join(streamFiber)
        const mirrored = yield* Ref.get(mirroredRef)

        expect(fromPubSub).toEqual(Arr.of(event))
        expect(mirrored).toEqual(Arr.of(event))
      })
    ))
})
