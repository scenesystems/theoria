/**
 * COPRO artifact projection contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Ref, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import {
  fullRunResponses,
  makeQaSignature,
  makeSequenceLayer,
  makeTrainset,
  prepareStructuredModule
} from "../helpers/copro.js"
import { CoproProgressionFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

describe("Optimizer.copro artifacts", () => {
  it.effect("projects typed study events, study snapshots, and artifact envelopes", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.copro.progression.basic")
      const fixture = yield* Schema.decodeUnknown(CoproProgressionFixtureSchema)(rawFixture)
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const snapshotRef = yield* Ref.make(Option.none<Optimizer.COPROSnapshot>())

      yield* prepareStructuredModule(module)
      yield* Optimizer.copro({
        module,
        trainset: makeTrainset(),
        metric: Metric.exactMatch("answer"),
        numCandidates: fixture.payload.numCandidates,
        maxSteps: fixture.payload.maxSteps,
        seed: fixture.payload.seed,
        snapshotSink: (snapshot) => Ref.set(snapshotRef, Option.some(snapshot))
      }).pipe(Effect.provide(makeSequenceLayer(fullRunResponses())))

      const snapshotOption = yield* Ref.get(snapshotRef)
      expect(Option.isSome(snapshotOption)).toBe(true)

      if (Option.isNone(snapshotOption)) {
        return
      }

      const studySnapshot = Optimizer.projectCOPROStudySnapshot(snapshotOption.value)
      const studyEvents = Optimizer.projectCOPROStudyEvents(snapshotOption.value)
      const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.2.0")
      const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-05T00:00:00Z")
      const eventEnvelope = Optimizer.coproStudyEventEnvelope({
        runId,
        packageVersion,
        emittedAt,
        metricName: "exactMatch",
        sequence: 0,
        event: studyEvents[0]!
      })
      const snapshotEnvelope = Optimizer.coproStudySnapshotEnvelope({
        runId,
        packageVersion,
        emittedAt,
        metricName: "exactMatch",
        sequence: 1,
        snapshot: snapshotOption.value
      })

      expect(studySnapshot.trials).toHaveLength(fixture.payload.trials.length)
      expect(studyEvents.at(-1)?._tag).toBe("StudyCompleted")
      expect(
        yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(
          yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(eventEnvelope)
        )
      ).toEqual(eventEnvelope)
      expect(
        yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(
          yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(snapshotEnvelope)
        )
      ).toEqual(snapshotEnvelope)
    }))
})
