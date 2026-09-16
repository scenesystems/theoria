import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  initializeRuntime,
  readRuntimeState,
  setRuntimeLifecycle
} from "../../src/internal/study/runtime/runtimeState.js"
import { makeStudyMachineSettings } from "../helpers/studyMachineSettings.js"

describe("machine lifecycle", () => {
  it.effect("transitions created -> running -> paused -> running -> completed and rejects terminal resume", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const runtime = yield* initializeRuntime(yield* makeStudyMachineSettings())

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
