import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  initializeRuntime,
  readRuntimeState,
  setRuntimeLifecycle,
  StudyClockLayer
} from "../../src/Study/runtime/runtimeState.js"
import { machineSettings } from "./machine/helpers.js"

describe("machine lifecycle", () => {
  it.effect("transitions created -> running -> paused -> running -> completed and rejects terminal resume", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const runtime = yield* initializeRuntime(machineSettings).pipe(Effect.provide(StudyClockLayer))

        const created = yield* readRuntimeState(runtime)
        expect(created.lifecycle).toBe("Created")

        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Paused")
        yield* setRuntimeLifecycle(runtime, "Running")
        yield* setRuntimeLifecycle(runtime, "Completed")
        yield* setRuntimeLifecycle(runtime, "Running")

        const completed = yield* readRuntimeState(runtime)
        expect(completed.lifecycle).toBe("Completed")
      })
    ))
})
