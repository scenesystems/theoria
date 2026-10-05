import { describe, expect, it } from "@effect/vitest"
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import * as ArtifactContext from "@scenesystems/effect-study/ArtifactContext"
import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"
import { Array as Arr, DateTime, Effect, Ref, Result, Schema } from "effect"

import * as Artifact from "../../src/Artifact.js"
import { envelopeEventPublisher } from "../../src/internal/optimization/events.js"
import * as OptimizationEvent from "../../src/OptimizationEvent.js"

const runIdText = "01HZ0000000000000000000000"

const makeMetadata = Effect.gen(function*() {
  const runId = yield* Schema.decodeEffect(StudyArtifact.RunId)(runIdText)
  const packageVersion = yield* Schema.decodeEffect(StudyArtifact.PackageVersion)("0.7.0")
  const component = yield* Schema.decodeEffect(StudyArtifact.ComponentPath)(Arr.make("Optimization", "artifact"))
  const emittedAt = yield* Effect.fromOption(DateTime.make("2024-01-01T00:00:00Z"))
  const sourceRef = yield* Schema.decodeEffect(Artifact.Source)({
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
  it.effect("propagates allocator failure before publishing an optimization envelope", () =>
    Effect.gen(function*() {
      const metadata = yield* makeMetadata
      const calls = yield* Ref.make(0)
      const failure = new PersistenceError.Failure({
        reason: "Backend",
        operation: "write",
        detail: "allocation unavailable"
      })
      const publisher = yield* envelopeEventPublisher({ emit: () => Ref.set(calls, 1) }).pipe(
        Effect.provide(ArtifactContext.layer(
          new ArtifactContext.Options({
            runId: metadata.producer.runId,
            packageVersion: metadata.producer.packageVersion,
            allocate: Effect.fail(failure)
          })
        ))
      )
      const result = yield* publisher.publish(OptimizationEvent.TrialCompleted({ trialNumber: 3, value: 0.25 })).pipe(
        Effect.result
      )
      expect(result).toEqual(Result.fail(failure))
      expect(yield* Ref.get(calls)).toBe(0)
    }))

  it.effect(
    "round-trips recursive JSON custom payloads",
    () =>
      Effect.gen(function*() {
        const metadata = yield* makeMetadata
        const validated = yield* Schema.decodeEffect(StudyArtifact.Payload)({ nested: Arr.make("value", 1, true) })
        const envelope = Artifact.Custom({
          ...metadata,
          payload: validated
        })
        const codec = Schema.fromJsonString(Artifact.Envelope)
        const encoded = yield* Schema.encodeEffect(codec)(envelope)
        const decoded = yield* Schema.decodeEffect(codec)(encoded)

        expect(decoded).toEqual(envelope)
      })
  )

  it.effect("canonicalizes nested negative zero only at the JSON transport boundary", () =>
    Effect.gen(function*() {
      const metadata = yield* makeMetadata
      const envelope = Artifact.Custom({ ...metadata, payload: { nested: { value: -0 } } })
      const direct = yield* Schema.encodeEffect(Artifact.Envelope)(envelope)
      const codec = Schema.fromJsonString(Artifact.Envelope)
      const json = yield* Schema.encodeEffect(codec)(envelope)
      const decoded = yield* Schema.decodeEffect(codec)(json)

      expect(direct).toMatchObject({ payload: { nested: { value: -0 } } })
      expect(decoded).toEqual({ ...envelope, payload: { nested: { value: 0 } } })
    }))

  it.effect("decodes persisted trial and event payloads with UTC timestamps", () =>
    Effect.gen(function*() {
      const metadata = yield* makeMetadata
      const encodedMetadata = {
        ...metadata,
        lineage: { ...metadata.lineage, emittedAt: "2024-01-01T00:00:00.000Z" }
      }
      const trial = yield* Schema.decodeEffect(Artifact.Envelope)({
        _tag: "TrialLog",
        ...encodedMetadata,
        trial: {
          trialNumber: 0,
          config: { learningRate: 0.1 },
          state: { _tag: "Completed", value: 1, duration: 12, retryCount: 0 }
        }
      })
      const event = yield* Schema.decodeEffect(Artifact.Envelope)({
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
      const encoded = yield* Schema.encodeEffect(Artifact.Envelope)(envelope)

      expect(encoded).toMatchObject({
        _tag: "OptimizationEvent",
        producer: { _tag: "EffectSearch", runId: runIdText },
        event: { _tag: "TrialCompleted", trialNumber: 3, value: 0.25 }
      })
    }))
})
