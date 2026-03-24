import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { TrialError } from "../../src/Errors/index.js"
import { snapshotToTrial, trialToSnapshot } from "../../src/Study/snapshot/stateCodec.js"
import * as StudyEvent from "../../src/StudyEvent/index.js"
import * as Trial from "../../src/Trial/index.js"

describe("Trial / typed error", () => {
  it.effect("stores TrialError in Failed state and preserves it through snapshot codec", () =>
    Effect.sync(() => {
      const running = Trial.makeRunning(3, { x: 1 }, 100)
      const error = new TrialError({
        trialNumber: 3,
        message: "objective failed",
        cause: "network"
      })
      const failed = Trial.fail(running, error, 145)
      const snapshot = trialToSnapshot(failed)
      const restored = snapshotToTrial(snapshot, running.config)

      expect(Trial.isState("Failed")(failed.state)).toBe(true)
      expect(Trial.isState("Failed")(restored.state)).toBe(true)

      if (Trial.isState("Failed")(restored.state)) {
        expect(restored.state.error).toBeInstanceOf(TrialError)
        expect(restored.state.error._tag).toBe("effect-search/TrialError")
        expect(restored.state.error.trialNumber).toBe(3)
      }
    }))

  it.effect("threads TrialError into StudyEvent.TrialFailed", () =>
    Effect.sync(() => {
      const trialError = new TrialError({
        trialNumber: 9,
        message: "objective timeout",
        cause: { timeout: true }
      })
      const event = StudyEvent.TrialFailed({ trialNumber: 9, error: trialError })

      expect(event._tag).toBe("TrialFailed")
      expect(event.error).toBeInstanceOf(TrialError)
      expect(event.error._tag).toBe("effect-search/TrialError")
    }))
})
