import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

const testRunId = "01HZ0000000000000000000000"

const makeTestLineage = Effect.gen(function*() {
  const runId = yield* Schema.decode(Contracts.RunId)(testRunId)
  const sourceRef = new Contracts.SourceRef({
    origin: "effect-search",
    domain: "study",
    segments: ["snapshot"]
  })
  const artifactId = new Contracts.ArtifactId({
    runId,
    sequence: 0
  })
  return new Contracts.ArtifactLineage({
    sourceRef,
    artifactId,
    emittedAt: DateTime.unsafeMake("2024-01-01T00:00:00Z")
  })
})

const makeTestProducer = Effect.gen(function*() {
  const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.1.0")
  const runId = yield* Schema.decode(Contracts.RunId)(testRunId)
  const component = yield* Schema.decode(Contracts.ComponentPath)(["Study", "snapshot"])
  return Contracts.EffectSearch({
    packageVersion,
    component,
    runId
  })
})

describe("contracts/ArtifactEnvelope", () => {
  it.effect("round-trips a Custom envelope through ArtifactEnvelopeSchema encode/decode", () =>
    Effect.gen(function*() {
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer

      const envelope = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        payload: { nextTrialNumber: 12, completedCount: 8 }
      })

      const encoded = yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)
      const decoded = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(encoded)

      expect(decoded._tag).toBe("Custom")
      expect(decoded.schemaVersion).toBe("artifact-envelope/v1")
      expect(decoded.lineage.sourceRef.origin).toBe("effect-search")
    }))

  it.effect("round-trips a TrialLog envelope through ArtifactEnvelopeSchema encode/decode", () =>
    Effect.gen(function*() {
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer

      const envelope = Contracts.TrialLog({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        trial: {
          trialNumber: 0,
          config: {},
          state: { _tag: "Completed", value: 1.0, duration: 100 }
        }
      })

      const encoded = yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)
      const decoded = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(encoded)

      expect(decoded._tag).toBe("TrialLog")
      expect(decoded.schemaVersion).toBe("artifact-envelope/v1")
    }))

  it.effect("matchEnvelope exhaustive pattern matching", () =>
    Effect.gen(function*() {
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer

      const envelope = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        payload: "hello"
      })

      const result = Contracts.matchEnvelope({
        TrialLog: () => "trial-log",
        StudySnapshot: () => "study-snapshot",
        StudyEvent: () => "study-event",
        Custom: (c) => `custom:${c.payload}`
      })(envelope)

      expect(result).toBe("custom:hello")
    }))
})
