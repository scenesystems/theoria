import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Deferred, Effect, Fiber, Stream, String as Str } from "effect"

import {
  initializeRuntime,
  runtimeChanges,
  setRuntimeLifecycle
} from "../../src/internal/study/runtime/runtimeState.js"
import { makeSettings } from "./machine/helpers.js"

describe("runtime streaming", () => {
  it.effect("streams every lifecycle transition after subscription", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const runtime = yield* initializeRuntime(yield* makeSettings())
        const subscribed = yield* Deferred.make<void>()

        const lifecycleFiber = yield* runtimeChanges(runtime).pipe(
          Stream.map((state) => state.lifecycle),
          Stream.tap(() => Deferred.succeed(subscribed, undefined)),
          Stream.takeUntil((lifecycle) => Str.Equivalence(lifecycle, "Completed")),
          Stream.runCollect,
          Effect.forkScoped
        )

        yield* Deferred.await(subscribed)
        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Paused")
        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Completed")

        const lifecycles = Chunk.toReadonlyArray(yield* Fiber.join(lifecycleFiber))
        expect(lifecycles).toEqual(Arr.make("Created", "Running", "Paused", "Running", "Completed"))
      })
    ))
})
