import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Fiber, PubSub, Ref, Stream } from "effect"

import { EventPublisher, eventPublisherFromPubSub, fanoutEventPublisher } from "../../src/Study/events.js"
import * as StudyEvent from "../../src/StudyEvent/index.js"

describe("pubsub event fanout", () => {
  it.effect("broadcasts events to pubsub stream and secondary sink", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const pubsub = yield* PubSub.unbounded<StudyEvent.StudyEvent>()
        const mirroredRef = yield* Ref.make<ReadonlyArray<StudyEvent.StudyEvent>>(Arr.empty())
        const mirroredPublisher = new EventPublisher({
          publish: (event) => Ref.update(mirroredRef, (events) => Arr.append(events, event))
        })
        const publisher = fanoutEventPublisher(eventPublisherFromPubSub(pubsub), mirroredPublisher)

        const event = StudyEvent.TrialStarted.make({ trialNumber: 1, config: { x: 0.5 } })
        const stream = yield* Stream.fromPubSub(pubsub, { scoped: true })
        const streamFiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        )

        yield* publisher.publish(event)

        const fromPubSub = Chunk.toReadonlyArray(yield* Fiber.join(streamFiber))
        const mirrored = yield* Ref.get(mirroredRef)

        expect(fromPubSub).toEqual([event])
        expect(mirrored).toEqual([event])
      })
    ))
})
