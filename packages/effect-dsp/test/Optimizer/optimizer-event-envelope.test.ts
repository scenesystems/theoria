/**
 * Optimizer event envelope projections.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Optimizer from "effect-dsp/Optimizer"

describe("OptimizerEventEnvelope", () => {
  it.effect("projects Bootstrap optimizer envelopes and decodes wrapped Bootstrap events", () =>
    Effect.gen(function*() {
      const event = Optimizer.BootstrapEvent.BootstrapFallbackActivated({
        threshold: 1,
        roundsAttempted: 2,
        acceptedTraces: 0,
        rejectedTraces: 6,
        bestScoreSeen: true,
        bestScore: 1 / 3,
        averageScore: 1 / 6,
        fallbackLabeledDemoCount: 3
      })
      const envelope = yield* Optimizer.OptimizerEventEnvelope.fromBootstrapEvent(event)
      const decoded = yield* Schema.decodeUnknown(Optimizer.OptimizerEventSchema)({
        _tag: "Bootstrap",
        event
      })

      expect(envelope.optimizer).toBe("bootstrapFewShot")
      expect(envelope.eventTag).toBe("BootstrapFallbackActivated")
      expect(envelope.payload.threshold).toBe(1)
      expect(envelope.payload.roundsAttempted).toBe(2)
      expect(envelope.payload.fallbackLabeledDemoCount).toBe(3)
      expect(decoded._tag).toBe("Bootstrap")
    }))

  it.effect("projects GEPA optimizer envelopes and decodes wrapped GEPA events", () =>
    Effect.gen(function*() {
      const event = Optimizer.GEPAEvent.OptimizationCompleted({
        iterations: 3,
        bestCandidateId: "candidate-9",
        frontierSize: 2
      })
      const envelope = yield* Optimizer.OptimizerEventEnvelope.fromGEPAEvent(event)
      const decoded = yield* Schema.decodeUnknown(Optimizer.OptimizerEventSchema)({
        _tag: "GEPA",
        event
      })

      expect(envelope.optimizer).toBe("gepa")
      expect(envelope.eventTag).toBe("OptimizationCompleted")
      expect(envelope.payload.bestCandidateId).toBe("candidate-9")
      expect(decoded._tag).toBe("GEPA")
    }))
})
