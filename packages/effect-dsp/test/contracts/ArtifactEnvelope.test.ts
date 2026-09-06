/**
 * Canonical artifact/provenance envelope contract tests.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as SearchContracts from "@scenesystems/effect-search/Contracts"
import { Effect, Schema } from "effect"

describe("contracts/ArtifactEnvelope", () => {
  it.effect("constructs a Custom envelope with EffectDsp producer", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.1.0")

      const envelope = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer: Contracts.EffectDsp({
          packageVersion,
          component: ["examples", "10-miprov2-social-science-panel"],
          runId,
          optimizer: "gepa",
          metricName: "exactMatch",
          exampleName: "10-miprov2-social-science-panel"
        }),
        lineage: new Contracts.ArtifactLineage({
          sourceRef: new Contracts.SourceRef({
            origin: "effect-dsp",
            domain: "example",
            segments: ["10", "summary"]
          }),
          artifactId: new SearchContracts.ArtifactId({ runId, sequence: 0 }),
          emittedAt: yield* Schema.decode(Schema.DateTimeUtc)("2023-11-14T22:13:20Z")
        }),
        payload: {
          score: 0.92,
          changed: true,
          labels: ["alpha", "beta"]
        }
      })

      expect(Contracts.isEnvelope("Custom")(envelope)).toBe(true)
      expect(envelope.payload).toEqual({
        score: 0.92,
        changed: true,
        labels: ["alpha", "beta"]
      })
    }))
})
