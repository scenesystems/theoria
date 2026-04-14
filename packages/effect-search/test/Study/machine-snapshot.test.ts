import { describe, expect, it } from "@effect/vitest"
import { Effect, Tuple } from "effect"

import {
  initializeRuntime,
  modifyStudyState,
  readRuntimeState,
  readStudyState,
  restoreRuntime,
  setRuntimeLifecycle,
  snapshotRuntime,
  StudyClockLayer
} from "../../src/Study/runtime/runtimeState.js"
import { trialsFromState, withReservedTrial } from "../../src/Study/state.js"
import { Trial } from "../../src/Trial/index.js"
import { machineSettings } from "./machine/helpers.js"

describe("machine snapshot", () => {
  it.effect("restores machine lifecycle and tracked trial state from snapshot", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const settings = machineSettings
        const runtime = yield* initializeRuntime(settings).pipe(Effect.provide(StudyClockLayer))

        const running = Trial.run(0, { x: 0, depth: 1 }, 0)
        yield* modifyStudyState(runtime, (state) =>
          Effect.succeed(Tuple.make(undefined, withReservedTrial(state, running))))
        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Paused")

        const snapshot = yield* snapshotRuntime(runtime)
        const restored = yield* restoreRuntime(settings, snapshot).pipe(Effect.provide(StudyClockLayer))
        const restoredRuntimeState = yield* readRuntimeState(restored)
        const restoredStudyState = yield* readStudyState(restored)

        expect(restoredRuntimeState.lifecycle).toBe("Paused")
        expect(trialsFromState(restoredStudyState)).toHaveLength(1)
      })
    ))
})
