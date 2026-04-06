import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { CanonicalFrame, canonicalFrameV1, DspCanonicalStep } from "../../app/contracts/canonical-step.js"
import { EvidenceEvent } from "../../app/contracts/evidence-stream.js"

const dspCanonicalStep = new DspCanonicalStep({
  scenarioId: "intervention-classifier",
  moduleType: "chainOfThought",
  stageId: "baseline",
  stepIndex: 1,
  stepCount: 4,
  metrics: {
    baselineAccuracy: 0.5,
    optimizedAccuracy: null,
    demosLearned: null,
    improvementDelta: null
  }
})

describe("CanonicalFrame Contract", () => {
  it.effect("decodes the explicit v1 frame envelope for package-authored steps", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(CanonicalFrame)(canonicalFrameV1(dspCanonicalStep))

      expect(decoded.version).toBe("v1")
      expect(decoded.step._tag).toBe("DspCanonicalStep")
    }))

  it.effect("rejects unknown frame versions at the evidence-stream boundary", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "Step",
        frame: {
          version: "v2",
          step: dspCanonicalStep
        }
      }).pipe(Effect.either)

      expect(result._tag).toBe("Left")
    }))

  it.effect("rejects widget-local frame shapes as canonical transport payloads", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "Step",
        frame: {
          version: "v1",
          step: {
            _tag: "effect-text",
            controls: {
              corpusIndex: 0,
              width: 280,
              obstaclesEnabled: false
            }
          }
        }
      }).pipe(Effect.either)

      expect(result._tag).toBe("Left")
    }))
})
