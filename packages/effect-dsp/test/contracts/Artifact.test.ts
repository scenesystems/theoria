/**
 * Canonical artifact/provenance envelope contract tests.
 */
import { describe, expect, it } from "@effect/vitest"
import { Artifact as DspArtifact } from "@scenesystems/effect-dsp/contracts"
import * as Artifact from "@scenesystems/effect-study/Artifact"
import { Array as Arr, Effect, Schema } from "effect"

describe("DSP example artifacts", () => {
  it.effect("encodes a versionless custom envelope with DSP-owned provenance", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(Artifact.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const packageVersion = yield* Schema.decode(Artifact.PackageVersion)("0.1.0")

      const envelope = yield* Schema.decode(DspArtifact.Envelope)({
        _tag: "Custom",
        producer: {
          _tag: "EffectDsp",
          packageVersion,
          component: Arr.make("examples", "10-miprov2-social-science-panel"),
          runId,
          optimizer: "gepa",
          metricName: "exactMatch",
          exampleName: "10-miprov2-social-science-panel"
        },
        lineage: {
          sourceRef: {
            origin: "effect-dsp",
            domain: "example",
            segments: Arr.make("10", "summary")
          },
          artifactId: new Artifact.Id({ runId, sequence: 0 }),
          emittedAt: "2023-11-14T22:13:20Z"
        },
        payload: {
          score: 0.92,
          changed: true,
          labels: ["alpha", "beta"]
        }
      })
      const encoded = yield* Schema.encode(DspArtifact.Envelope)(envelope)

      expect(envelope._tag).toBe("Custom")
      expect(encoded).not.toHaveProperty("schemaVersion")
      expect(envelope.payload).toEqual({
        score: 0.92,
        changed: true,
        labels: ["alpha", "beta"]
      })
    }))
})
