/**
 * Study stream bridge contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Deferred, Effect, Exit, Fiber, Ref, Stream } from "effect"

import * as Study from "../../src/Study/index.js"

class StreamBridgeFailure extends Data.TaggedError("StreamBridgeFailure")<{
  readonly message: string
}> {}

describe("Study.streamFromEmitter", () => {
  it.effect("streams emitted events in-order then completes", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Study.streamFromEmitter<string, void, never, never>((emit) =>
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
        Study.streamFromEmitter<string, void, StreamBridgeFailure, never>((emit: Study.EmitterSink<string>) =>
          Effect.gen(function*() {
            yield* emit("first")
            return yield* Effect.fail(new StreamBridgeFailure({ message: "boom" }))
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
        Study.streamFromEmitter<string, void, never, never>((emit) =>
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
              event === "tail"
                ? Deferred.succeed(tailSeen, undefined).pipe(Effect.asVoid)
                : Effect.void
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
})
