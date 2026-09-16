import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import * as OptimizationEvent from "../../src/OptimizationEvent.js"
import { fromTrial, toTrial } from "../../src/OptimizationSnapshot.js"
import { TrialError } from "../../src/SearchError.js"
import * as Trial from "../../src/Trial.js"

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
      const snapshot = fromTrial(failed)
      const restored = toTrial(snapshot, running.config)

      expect(Trial.isState("Failed")(failed.state)).toBe(true)
      expect(Trial.isState("Failed")(restored.state)).toBe(true)

      const failure = Option.liftPredicate(restored.state, Trial.isState("Failed")).pipe(Option.getOrThrow)
      expect(failure.error).toBeInstanceOf(TrialError)
      expect(failure.error._tag).toBe("effect-search/TrialError")
      expect(failure.error.trialNumber).toBe(3)
    }))

  it.effect("threads TrialError into OptimizationEvent.TrialFailed", () =>
    Effect.sync(() => {
      const trialError = new TrialError({
        trialNumber: 9,
        message: "objective timeout",
        cause: { timeout: true }
      })
      const event = OptimizationEvent.TrialFailed({ trialNumber: 9, error: trialError })

      expect(event._tag).toBe("TrialFailed")
      expect(event.error).toBeInstanceOf(TrialError)
      expect(event.error._tag).toBe("effect-search/TrialError")
    }))
})
