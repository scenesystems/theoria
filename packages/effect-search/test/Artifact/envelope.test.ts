import { describe, expect, it } from "@effect/vitest"
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import { Array as Arr, DateTime, Effect, FastCheck, Schema } from "effect"

import * as Artifact from "../../src/Artifact.js"
import * as OptimizationEvent from "../../src/OptimizationEvent.js"

const runIdText = "01HZ0000000000000000000000"

const makeMetadata = Effect.gen(function*() {
  const runId = yield* Schema.decode(StudyArtifact.RunId)(runIdText)
  const packageVersion = yield* Schema.decode(StudyArtifact.PackageVersion)("0.7.0")
  const component = yield* Schema.decode(StudyArtifact.ComponentPath)(Arr.make("Optimization", "artifact"))
  const emittedAt = yield* DateTime.make("2024-01-01T00:00:00Z")
  const sourceRef = yield* Schema.decodeUnknown(Artifact.Source)({
    origin: "effect-search",
    domain: "optimization",
    segments: Arr.of("custom")
  })
  return {
    producer: Artifact.EffectSearch({ packageVersion, component, runId }),
    lineage: {
      sourceRef,
      artifactId: new StudyArtifact.Id({ runId, sequence: 0 }),
      emittedAt
    },
    relations: Arr.of(StudyArtifact.Run({ ref: runId }))
  }
})

describe("Artifact", () => {
  it.effect.prop(
    "round-trips recursive JSON custom payloads",
    { payload: FastCheck.jsonValue() },
    ({ payload }) =>
      Effect.gen(function*() {
        const metadata = yield* makeMetadata
        const validated = yield* Schema.decodeUnknown(StudyArtifact.Payload)(payload)
        const envelope = Artifact.Custom({
          ...metadata,
          payload: validated
        })
        const codec = Schema.parseJson(Artifact.Envelope)
        const encoded = yield* Schema.encode(codec)(envelope)
        const decoded = yield* Schema.decode(codec)(encoded)

        expect(decoded).toEqual(envelope)
      })
  )

  it.effect("decodes persisted trial and event payloads with UTC timestamps", () =>
    Effect.gen(function*() {
      const metadata = yield* makeMetadata
      const encodedMetadata = {
        ...metadata,
        lineage: { ...metadata.lineage, emittedAt: "2024-01-01T00:00:00.000Z" }
      }
      const trial = yield* Schema.decodeUnknown(Artifact.Envelope)({
        _tag: "TrialLog",
        ...encodedMetadata,
        trial: {
          trialNumber: 0,
          config: { learningRate: 0.1 },
          state: { _tag: "Completed", value: 1, duration: 12, retryCount: 0 }
        }
      })
      const event = yield* Schema.decodeUnknown(Artifact.Envelope)({
        _tag: "OptimizationEvent",
        ...encodedMetadata,
        event: { _tag: "TrialCompleted", trialNumber: 0, value: 1 }
      })

      expect(trial).toMatchObject({
        trial: { config: { learningRate: 0.1 }, state: { value: 1, duration: 12 } }
      })
      expect(event).toMatchObject({ event: { trialNumber: 0, value: 1 } })
      expect(DateTime.formatIso(trial.lineage.emittedAt)).toBe("2024-01-01T00:00:00.000Z")
      expect(DateTime.formatIso(event.lineage.emittedAt)).toBe("2024-01-01T00:00:00.000Z")
    }))

  it.effect("encodes an optimization event with its producer and observation", () =>
    Effect.gen(function*() {
      const metadata = yield* makeMetadata
      const envelope = Artifact.OptimizationEvent({
        ...metadata,
        event: OptimizationEvent.TrialCompleted({ trialNumber: 3, value: 0.25 })
      })
      const encoded = yield* Schema.encode(Artifact.Envelope)(envelope)

      expect(encoded).toMatchObject({
        _tag: "OptimizationEvent",
        producer: { _tag: "EffectSearch", runId: runIdText },
        event: { _tag: "TrialCompleted", trialNumber: 3, value: 0.25 }
      })
    }))
})
