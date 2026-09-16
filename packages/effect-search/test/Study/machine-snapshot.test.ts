import { describe, expect, it } from "@effect/vitest"
import * as History from "@scenesystems/effect-study/History"
import { Effect, Tuple } from "effect"

import {
  initializeRuntime,
  modifyStudyState,
  readRuntimeState,
  readStudyState,
  restoreRuntime,
  setRuntimeLifecycle,
  snapshotRuntime
} from "../../src/internal/study/runtime/runtimeState.js"
import * as Trial from "../../src/Trial.js"
import { makeSettings } from "./machine/helpers.js"

describe("machine snapshot", () => {
  it.effect("restores machine lifecycle and tracked trial state from snapshot", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const settings = yield* makeSettings()
        const runtime = yield* initializeRuntime(settings)

        const running = Trial.makeRunning(0, { x: 0, depth: 1 }, 0)
        yield* modifyStudyState(runtime, (state) => Effect.succeed(Tuple.make(undefined, History.set(state, running))))
        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Paused")

        const snapshot = yield* snapshotRuntime(runtime)
        const restored = yield* restoreRuntime(settings, snapshot)
        const restoredRuntimeState = yield* readRuntimeState(restored)
        const restoredStudyState = yield* readStudyState(restored)

        expect(restoredRuntimeState.lifecycle).toBe("Paused")
        expect(History.values(restoredStudyState)).toHaveLength(1)
      })
    ))
})
