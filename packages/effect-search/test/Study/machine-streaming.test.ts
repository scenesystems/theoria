import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Stream } from "effect"

import {
  initializeRuntime,
  runtimeChanges,
  setRuntimeLifecycle,
  StudyClockLayer
} from "../../src/Study/runtime/runtimeState.js"
import { makeSettings } from "./machine/helpers.js"

describe("machine streaming", () => {
  it.effect("streams lifecycle transitions through actor changes", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const runtime = yield* initializeRuntime(makeSettings()).pipe(Effect.provide(StudyClockLayer))

        const lifecycleFiber = yield* runtimeChanges(runtime).pipe(
          Stream.map((state) => state.lifecycle),
          Stream.takeUntil((lifecycle) => lifecycle === "Completed"),
          Stream.runCollect,
          Effect.fork
        )

        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Paused")
        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Completed")

        const lifecycles = Chunk.toReadonlyArray(yield* Fiber.join(lifecycleFiber))
        expect(lifecycles).toContain("Running")
        expect(lifecycles).toContain("Paused")
        expect(lifecycles[lifecycles.length - 1]).toBe("Completed")
      })
    ))
})
