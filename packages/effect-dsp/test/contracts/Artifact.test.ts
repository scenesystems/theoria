/**
 * Canonical artifact/provenance envelope contract tests.
 */
import { describe, expect, it } from "@effect/vitest"
import * as SearchArtifact from "@scenesystems/effect-search/Artifact"
import * as Artifact from "@scenesystems/effect-study/Artifact"
import { Array as Arr, Effect, Schema } from "effect"

describe("effect-search Artifact", () => {
  it.effect("constructs a Custom envelope with EffectDsp producer", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(Artifact.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const packageVersion = yield* Schema.decode(Artifact.PackageVersion)("0.1.0")

      const envelope = SearchArtifact.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer: SearchArtifact.EffectDsp({
          packageVersion,
          component: Arr.make("examples", "10-miprov2-social-science-panel"),
          runId,
          optimizer: "gepa",
          metricName: "exactMatch",
          exampleName: "10-miprov2-social-science-panel"
        }),
        lineage: {
          sourceRef: {
            origin: "effect-dsp",
            domain: "example",
            segments: Arr.make("10", "summary")
          },
          artifactId: new Artifact.Id({ runId, sequence: 0 }),
          emittedAt: yield* Schema.decode(Schema.DateTimeUtc)("2023-11-14T22:13:20Z")
        },
        payload: {
          score: 0.92,
          changed: true,
          labels: ["alpha", "beta"]
        }
      })

      expect(SearchArtifact.is("Custom")(envelope)).toBe(true)
      expect(envelope.payload).toEqual({
        score: 0.92,
        changed: true,
        labels: ["alpha", "beta"]
      })
    }))
})
