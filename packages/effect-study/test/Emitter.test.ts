/**
 * Study stream bridge contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Deferred, Effect, Exit, Fiber, Ref, Stream, String as Str } from "effect"

import * as Emitter from "@scenesystems/effect-study/Emitter"

class StreamBridgeFailure extends Data.TaggedError("StreamBridgeFailure")<{
  readonly message: string
}> {}

describe("Emitter.toStream", () => {
  it.effect("streams emitted events in-order then completes", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Emitter.toStream<string, void, never, never>((emit) =>
          Effect.gen(function*() {
            yield* emit("first")
            yield* emit("second")
          })
        )
      )

      expect(Arr.fromIterable(events)).toEqual(Arr.make("first", "second"))
    }))

  it.effect("preserves failure channel while yielding prior events", () =>
    Effect.gen(function*() {
      const seenRef = yield* Ref.make(Arr.empty<string>())
      const failureExit = yield* Effect.exit(
        Emitter.toStream<string, void, StreamBridgeFailure, never>((emit: Emitter.Emitter<string>) =>
          Effect.gen(function*() {
            yield* emit("first")
            return yield* new StreamBridgeFailure({ message: "boom" })
          })
        ).pipe(
          Stream.runForEach((event) => Ref.update(seenRef, (seen) => Arr.append(seen, event)))
        )
      )
      const seen = yield* Ref.get(seenRef)

      expect(seen).toEqual(Arr.make("first"))
      expect(failureExit).toEqual(Exit.fail(new StreamBridgeFailure({ message: "boom" })))
    }))

  it.effect("delivers the final emitted event before another merged branch completes", () =>
    Effect.gen(function*() {
      const continueRef = yield* Deferred.make<void>()
      const tailSeen = yield* Deferred.make<void>()
      const seenRef = yield* Ref.make(Arr.empty<string>())

      const merged = Stream.merge(
        Emitter.toStream<string, void, never, never>((emit) =>
          Effect.gen(function*() {
            yield* emit("first")
            yield* emit("tail")
          })
        ),
        Stream.fromEffect(Deferred.await(continueRef)).pipe(
          Stream.flatMap(() => Stream.succeed("other"))
        ),
        { haltStrategy: "both" }
      )

      const fiber = yield* merged.pipe(
        Stream.runForEach((event) =>
          Ref.update(seenRef, (seen) => Arr.append(seen, event)).pipe(
            Effect.zipRight(
              Deferred.succeed(tailSeen, undefined).pipe(Effect.when(() => Str.Equivalence(event, "tail")))
            )
          )
        ),
        Effect.fork
      )

      yield* Deferred.await(tailSeen)
      yield* Deferred.succeed(continueRef, undefined)
      yield* Fiber.join(fiber)

      const seen = yield* Ref.get(seenRef)

      expect(seen).toEqual(Arr.make("first", "tail", "other"))
    }))

  it.effect("propagates producer defects after buffered events", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make(Arr.empty<string>())
      const exit = yield* Emitter.toStream((emit: Emitter.Emitter<string>) =>
        emit("before").pipe(Effect.zipRight(Effect.die("producer defect")))
      ).pipe(
        Stream.runForEach((event) => Ref.update(seen, Arr.append(event))),
        Effect.exit
      )
      expect(yield* Ref.get(seen)).toEqual(Arr.of("before"))
      expect(exit).toEqual(Exit.die("producer defect"))
    }))

  it.effect("releases the producer when the consumer ends early", () =>
    Effect.gen(function*() {
      const active = yield* Ref.make(false)
      const events = yield* Emitter.toStream((emit: Emitter.Emitter<string>) =>
        Effect.acquireUseRelease(
          Ref.set(active, true),
          () => emit("first").pipe(Effect.zipRight(Effect.never)),
          () => Ref.set(active, false)
        )
      ).pipe(Stream.take(1), Stream.runCollect)
      expect(Arr.fromIterable(events)).toEqual(Arr.of("first"))
      expect(yield* Ref.get(active)).toBe(false)
    }))
})
