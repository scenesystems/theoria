/**
 * Contract for execution-backed coding judging.
 */
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

const Execution = Experimental.OpenAgentTrace.Execution

describe("OpenAgentTrace/codingExecution", () => {
  it.effect("proves the execution judge scores patch application plus check, lint, test, and build outcomes from the checked-in repository fixture", () =>
    Effect.gen(function*() {
      const success = yield* Execution.runCodingExecutionReplayHarness({
        fixtureId: Execution.COUNTER_ITEMS_EXECUTION_FIXTURE_ID,
        applyPatch: true
      })
      const failure = yield* Execution.runCodingExecutionReplayHarness({
        fixtureId: Execution.COUNTER_ITEMS_EXECUTION_FIXTURE_ID,
        applyPatch: false
      })

      expect(success.record.source.sessionId).toBe("T-019d8314-fca6-75bd-b996-2adcb0f10fa2")
      expect(success.judge.patchApplied).toBe(true)
      expect(success.judge.allPassed).toBe(true)
      expect(success.judge.score).toBe(1)
      expect(success.judge.fileTouches).toEqual(["counter.ts"])
      expect(success.judge.runs.map((run) => run.stage)).toEqual(["check", "lint", "test", "build"])
      expect(success.judge.runs.every((run) => run.passed)).toBe(true)
      expect(success.judge.feedback).toContain("Patch applied")
      expect(failure.judge.patchApplied).toBe(false)
      expect(failure.judge.allPassed).toBe(false)
      expect(failure.judge.score).toBe(0)
      expect(failure.judge.runs.every((run) => run.passed === false)).toBe(true)
      expect(failure.judge.feedback).toContain("Failed: check, lint, test, build")
    }).pipe(Effect.provide(BunContext.layer)))
})
