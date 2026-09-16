import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"

import * as Sampler from "../../src/Sampler.js"
import * as Study from "../../src/Study.js"
import * as StudySnapshot from "../../src/StudySnapshot.js"
import { snapshotSingleObjective, snapshotSingleObjectiveResult, snapshotSpace } from "../helpers/studySnapshots.js"

const legacyPayloadFromSnapshot = (snapshot: StudySnapshot.StudySnapshot): unknown => {
  const { snapshotFormatVersion: _snapshotFormatVersion, ...legacy } = snapshot

  return {
    ...legacy,
    version: 1
  }
}

describe("snapshot format versioning", () => {
  it.effect("Study.snapshot emits snapshotFormatVersion and decodes via variant schema", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 4321 }),
        direction: "minimize",
        trials: 6,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(result)

      const snapshot = yield* Study.snapshot(single)
      const decodedWithVariant = yield* Schema.decodeUnknown(StudySnapshot.StudySnapshot)(snapshot)

      expect(snapshot.snapshotFormatVersion).toBe(1)
      expect(decodedWithVariant.snapshotFormatVersion).toBe(1)
    }))

  it.effect("StudySnapshot.decodeUnknown recomputes counters instead of trusting persisted diagnostics", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 1212 }),
        direction: "minimize",
        trials: 5,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(result)

      const snapshot = yield* Study.snapshot(single)

      const decoded = yield* StudySnapshot.decodeUnknown({
        ...snapshot,
        nextTrialNumber: 99,
        samplerMetrics: {
          checkpointTag: "stale",
          completedCount: -1,
          retryCountTotal: 12,
          priorCount: 8
        }
      })

      expect(decoded.nextTrialNumber).toBe(5)
      expect(decoded.samplerMetrics).toEqual({
        checkpointTag: "Random",
        completedCount: 5,
        retryCountTotal: 0,
        priorCount: 0
      })
      expect(decoded.trials).toEqual(snapshot.trials)
    }))

  it.effect("StudySnapshot.decodeUnknown rejects legacy `version` payloads", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 8181 }),
        direction: "minimize",
        trials: 4,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(result)

      const snapshot = yield* Study.snapshot(single)
      const legacyPayload = legacyPayloadFromSnapshot(snapshot)
      const decoded = yield* Effect.either(StudySnapshot.decodeUnknown(legacyPayload))

      yield* Either.match(decoded, {
        onLeft: () => Effect.void,
        onRight: () => Effect.dieMessage("Expected StudySnapshot.decodeUnknown to reject a legacy version payload")
      })
    }))

  it.effect("Study.resume preserves trial continuity with canonical snapshot payload", () =>
    Effect.gen(function*() {
      const firstLeg = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 9090 }),
        direction: "minimize",
        trials: 4,
        objective: snapshotSingleObjective
      })

      const firstSingle = yield* snapshotSingleObjectiveResult(firstLeg)

      const firstSnapshot = yield* Study.snapshot(firstSingle)

      const resumed = yield* Study.resume({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 9090 }),
        snapshot: firstSnapshot,
        direction: "minimize",
        trials: 3,
        objective: snapshotSingleObjective
      })

      const resumedSingle = yield* snapshotSingleObjectiveResult(resumed)

      const resumedSnapshot = yield* Study.snapshot(resumedSingle)
      expect(resumedSnapshot.snapshotFormatVersion).toBe(1)
      expect(Arr.map(Arr.fromIterable(resumedSingle.trials), (trial) => trial.trialNumber)).toEqual([
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ])
    }))
})
