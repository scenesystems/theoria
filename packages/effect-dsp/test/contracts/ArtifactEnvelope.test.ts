/**
 * Canonical artifact/provenance envelope contract tests.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as SearchContracts from "effect-search/Contracts"

describe("contracts/ArtifactEnvelope", () => {
  it("re-exports are identity-equal to effect-search originals", () => {
    expect(Contracts.ArtifactEnvelopeSchema).toBe(SearchContracts.ArtifactEnvelopeSchema)
    expect(Contracts.ArtifactEnvelopeVersion).toBe(SearchContracts.ArtifactEnvelopeVersion)
    expect(Contracts.ArtifactLineage).toBe(SearchContracts.ArtifactLineage)
    expect(Contracts.ArtifactPayload).toBe(SearchContracts.ArtifactPayload)
    expect(Contracts.ArtifactRelationSchema).toBe(SearchContracts.ArtifactRelationSchema)
    expect(Contracts.ArtifactSink).toBe(SearchContracts.ArtifactSink)
    expect(Contracts.BindingRef).toBe(SearchContracts.BindingRef)
    expect(Contracts.ComponentPath).toBe(SearchContracts.ComponentPath)
    expect(Contracts.ContentDigest).toBe(SearchContracts.ContentDigest)
    expect(Contracts.Custom).toBe(SearchContracts.Custom)
    expect(Contracts.EffectDsp).toBe(SearchContracts.EffectDsp)
    expect(Contracts.EffectSearch).toBe(SearchContracts.EffectSearch)
    expect(Contracts.EnvelopeContext).toBe(SearchContracts.EnvelopeContext)
    expect(Contracts.EnvelopeContextLive).toBe(SearchContracts.EnvelopeContextLive)
    expect(Contracts.ExternalProducer).toBe(SearchContracts.ExternalProducer)
    expect(Contracts.InstrumentRef).toBe(SearchContracts.InstrumentRef)
    expect(Contracts.isEnvelope).toBe(SearchContracts.isEnvelope)
    expect(Contracts.matchEnvelope).toBe(SearchContracts.matchEnvelope)
    expect(Contracts.ObservationRef).toBe(SearchContracts.ObservationRef)
    expect(Contracts.PackageVersion).toBe(SearchContracts.PackageVersion)
    expect(Contracts.ProtocolRef).toBe(SearchContracts.ProtocolRef)
    expect(Contracts.RunId).toBe(SearchContracts.RunId)
    expect(Contracts.SlotEdgeRef).toBe(SearchContracts.SlotEdgeRef)
    expect(Contracts.SlotRef).toBe(SearchContracts.SlotRef)
    expect(Contracts.SourceRef).toBe(SearchContracts.SourceRef)
    expect(Contracts.StudyEventEnvelope).toBe(SearchContracts.StudyEventEnvelope)
    expect(Contracts.StudySnapshotEnvelope).toBe(SearchContracts.StudySnapshotEnvelope)
    expect(Contracts.TrialLog).toBe(SearchContracts.TrialLog)
    expect(Contracts.emit).toBe(SearchContracts.emit)
    expect(Contracts.fileSystemSink).toBe(SearchContracts.fileSystemSink)
  })

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
      expect(envelope._tag).toBe("Custom")

      const producer = envelope.producer
      expect(producer._tag).toBe("EffectDsp")
      expect(producer._tag === "EffectDsp" && producer.optimizer).toBe("gepa")
      expect(producer._tag === "EffectDsp" && producer.metricName).toBe("exactMatch")
      expect(producer._tag === "EffectDsp" && producer.exampleName).toBe("10-miprov2-social-science-panel")
    }))
})
