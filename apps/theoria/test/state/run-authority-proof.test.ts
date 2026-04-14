import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { reduceRunState } from "../../app/web/state/run/reducer.js"
import { RunOwnership } from "../../app/web/state/run/types.js"
import { errorFixture, programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"
import { runningRunState, runStartedMessage } from "../helpers/run-state.js"

describe("runtime spine run authority", () => {
  it.effect("keeps the public lifecycle on RunRunning until the single success gate seals the run", () =>
    Effect.gen(function*() {
      const running = runningRunState({
        program: programPreviewFixture.program,
        sequence: 4,
        token: 7
      })
      const afterStreamCompletion = reduceRunState(running, {
        _tag: "RunStreamCompleteObserved",
        sequence: 4,
        observedAtMs: 10,
        summary: "stream observed",
        meta: null
      })
      const afterStepQueueDrain = reduceRunState(afterStreamCompletion, {
        _tag: "RunStepQueueDrained",
        sequence: 4,
        observedAtMs: 11
      })
      const final = reduceRunState(afterStepQueueDrain, {
        _tag: "RunSucceeded",
        sequence: 4,
        finalizedAtMs: 12,
        data: runDataFixture("sealed success"),
        meta: null
      })

      expect(running._tag).toBe("RunRunning")
      expect(afterStreamCompletion._tag).toBe("RunRunning")
      expect(afterStepQueueDrain._tag).toBe("RunRunning")
      expect(afterStreamCompletion.session.facts.hasStreamCompletion()).toBe(true)
      expect(afterStreamCompletion.session.facts.hasStepQueueDrain()).toBe(false)
      expect(afterStepQueueDrain.session.facts.hasStreamCompletion()).toBe(true)
      expect(afterStepQueueDrain.session.facts.hasStepQueueDrain()).toBe(true)
      expect(final._tag).toBe("RunSuccess")
    }))

  it.effect("keeps stop, reset, and replay on the same run authority while ignoring stale prior-run messages", () =>
    Effect.gen(function*() {
      const firstRun = runningRunState({
        program: programPreviewFixture.program,
        sequence: 1,
        token: 1
      })
      const stopping = reduceRunState(firstRun, {
        _tag: "RunStopping",
        sequence: 1,
        requestedAtMs: 2
      })
      const stopped = reduceRunState(stopping, {
        _tag: "RunStopped",
        sequence: 1,
        stoppedAtMs: 3
      })
      const reset = reduceRunState(stopped, { _tag: "RunReset" })
      const replay = reduceRunState(
        reset,
        runStartedMessage({
          token: 2,
          sequence: 2,
          ownership: RunOwnership.sharedStreaming(),
          startedAtMs: 4,
          program: programPreviewFixture.program
        })
      )
      const staleFailure = reduceRunState(replay, {
        _tag: "RunFailed",
        sequence: 1,
        finalizedAtMs: 4,
        error: errorFixture
      })
      const staleSuccess = reduceRunState(replay, {
        _tag: "RunSucceeded",
        sequence: 1,
        finalizedAtMs: 5,
        data: runDataFixture("stale success"),
        meta: null
      })
      const replayWithFacts = reduceRunState(
        reduceRunState(replay, {
          _tag: "RunStreamCompleteObserved",
          sequence: 2,
          observedAtMs: 6,
          summary: "replayed",
          meta: null
        }),
        {
          _tag: "RunStepQueueDrained",
          sequence: 2,
          observedAtMs: 7
        }
      )
      const final = reduceRunState(replayWithFacts, {
        _tag: "RunSucceeded",
        sequence: 2,
        finalizedAtMs: 8,
        data: runDataFixture("replayed"),
        meta: null
      })

      expect(stopping._tag).toBe("RunRunning")
      expect(stopping.session.control).toBe("stopping")
      expect(stopped._tag).toBe("RunIdle")
      expect(stopped.session.draft).toEqual(firstRun.session.draft)
      expect(stopped.session.identity).toEqual(firstRun.session.identity)
      expect(stopped.session.telemetry.events.at(-1)?.detail).toBe("stopped")
      expect(reset._tag).toBe("RunIdle")
      expect(reset.session.draft).toBeNull()
      expect(reset.session.identity).toBeNull()
      expect(replay._tag).toBe("RunRunning")
      if (replay._tag === "RunRunning") {
        expect(replay.sequence).toBe(2)
      }
      expect(staleFailure).toEqual(replay)
      expect(staleSuccess).toEqual(replay)
      expect(final._tag).toBe("RunSuccess")
    }))
})
