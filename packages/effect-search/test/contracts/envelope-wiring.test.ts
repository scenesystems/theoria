import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Ref, Schema } from "effect"

import type { ArtifactEnvelope } from "../../src/contracts/ArtifactEnvelope.js"
import {
  type ArtifactSinkApi,
  EnvelopeContextLive,
  isEnvelope,
  PackageVersion,
  RunId
} from "../../src/contracts/index.js"
import { envelopeEventPublisher } from "../../src/Study/events.js"
import * as StudyEvent from "../../src/StudyEvent/index.js"

const TEST_RUN_ID = "01HZ0000000000000000000000"

const makeTestEnvelopeContextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(RunId)(TEST_RUN_ID)
  const packageVersion = yield* Schema.decode(PackageVersion)("0.1.0")
  return EnvelopeContextLive({ packageVersion, runId, studyId: "test-study" })
}).pipe(Layer.unwrapEffect)

const makeCollectingSink = Effect.gen(function*() {
  const collected = yield* Ref.make<ReadonlyArray<ArtifactEnvelope>>([])
  const sink: ArtifactSinkApi = {
    emit: (envelope) => Ref.update(collected, (arr) => [...arr, envelope])
  }
  return { sink, collected }
})

const getEnvelope = (envelopes: ReadonlyArray<ArtifactEnvelope>, index: number) =>
  Arr.get(envelopes, index).pipe(
    Option.getOrThrowWith(() => `expected envelope at index ${index}`)
  )

describe("contracts/envelope-wiring", () => {
  it.effect("envelopeEventPublisher wraps StudyEvent in StudyEventEnvelope with correct lineage", () =>
    Effect.gen(function*() {
      const { sink, collected } = yield* makeCollectingSink
      const publisher = yield* envelopeEventPublisher(sink)

      yield* publisher.publish(StudyEvent.TrialCompleted.make({ trialNumber: 0, value: 1.5 }))
      yield* publisher.publish(StudyEvent.BestUpdated.make({ trialNumber: 0, value: 1.5 }))

      const envelopes = yield* Ref.get(collected)
      expect(envelopes).toHaveLength(2)

      const first = getEnvelope(envelopes, 0)
      expect(first._tag).toBe("StudyEvent")
      expect(first.schemaVersion).toBe("artifact-envelope/v1")
      expect(first.producer._tag).toBe("EffectSearch")
      expect(first.lineage.sourceRef.origin).toBe("effect-search")
      expect(first.lineage.sourceRef.domain).toBe("study")
      expect(first.lineage.artifactId.sequence).toBe(0)

      const second = getEnvelope(envelopes, 1)
      expect(second._tag).toBe("StudyEvent")
      expect(second.lineage.artifactId.sequence).toBe(1)
    }).pipe(Effect.provide(makeTestEnvelopeContextLayer)))

  it.effect("emitted envelopes carry RunRelation linking to the context runId", () =>
    Effect.gen(function*() {
      const { sink, collected } = yield* makeCollectingSink
      const publisher = yield* envelopeEventPublisher(sink)

      yield* publisher.publish(StudyEvent.TrialCompleted.make({ trialNumber: 0, value: 1.0 }))

      const envelopes = yield* Ref.get(collected)
      const envelope = getEnvelope(envelopes, 0)

      expect(envelope.relations).toBeDefined()
      expect(envelope.relations).toHaveLength(1)

      const relation = Arr.get(envelope.relations ?? [], 0).pipe(
        Option.getOrThrowWith(() => "expected relation at index 0")
      )
      expect(relation._tag).toBe("Run")
      expect(relation._tag === "Run" && relation.ref).toBe(TEST_RUN_ID)
    }).pipe(Effect.provide(makeTestEnvelopeContextLayer)))

  it.effect("envelopeEventPublisher produces monotonically increasing artifact IDs", () =>
    Effect.gen(function*() {
      const { sink, collected } = yield* makeCollectingSink
      const publisher = yield* envelopeEventPublisher(sink)

      yield* Effect.forEach(
        [0, 1, 2, 3, 4],
        (trialNumber) => publisher.publish(StudyEvent.TrialStarted.make({ trialNumber, config: {} })),
        { discard: true }
      )

      const envelopes = yield* Ref.get(collected)
      const sequences = Arr.map(envelopes, (e) => e.lineage.artifactId.sequence)
      expect(sequences).toEqual([0, 1, 2, 3, 4])
    }).pipe(Effect.provide(makeTestEnvelopeContextLayer)))

  it.effect("envelopeEventPublisher carries branded RunId and PackageVersion from context", () =>
    Effect.gen(function*() {
      const { sink, collected } = yield* makeCollectingSink
      const publisher = yield* envelopeEventPublisher(sink)

      yield* publisher.publish(StudyEvent.StudyCompleted.make({ completionReason: "budgetExhausted" }))

      const envelopes = yield* Ref.get(collected)
      const envelope = getEnvelope(envelopes, 0)
      expect(envelope.producer._tag).toBe("EffectSearch")

      const producer = envelope.producer
      expect(producer._tag === "EffectSearch" && producer.runId).toBe(TEST_RUN_ID)
      expect(producer._tag === "EffectSearch" && producer.packageVersion).toBe("0.1.0")
      expect(producer._tag === "EffectSearch" && producer.component).toEqual(["Study", "events"])
    }).pipe(Effect.provide(makeTestEnvelopeContextLayer)))

  it.effect("isEnvelope guard works on emitted envelopes", () =>
    Effect.gen(function*() {
      const { sink, collected } = yield* makeCollectingSink
      const publisher = yield* envelopeEventPublisher(sink)

      yield* publisher.publish(StudyEvent.TrialCompleted.make({ trialNumber: 0, value: 2.0 }))

      const envelopes = yield* Ref.get(collected)
      const envelope = getEnvelope(envelopes, 0)
      expect(isEnvelope("StudyEvent")(envelope)).toBe(true)
      expect(isEnvelope("TrialLog")(envelope)).toBe(false)
    }).pipe(Effect.provide(makeTestEnvelopeContextLayer)))
})
