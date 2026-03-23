import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Option, Schema } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import { asSingleObjective, makeSpace, singleObjective } from "./helpers.js"

const legacyPayloadFromSnapshot = (snapshot: Study.StudySnapshot): unknown => {
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
        space: makeSpace(),
        sampler: Sampler.random({ seed: 4321 }),
        direction: "minimize",
        trials: 6,
        objective: singleObjective
      })

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const decodedWithVariant = Schema.decodeUnknownSync(Study.StudySnapshotFormatVariantSchema)(snapshot)

      expect(snapshot.snapshotFormatVersion).toBe(1)
      expect(decodedWithVariant.snapshotFormatVersion).toBe(1)
    }))

  it.effect("decodeStudySnapshot round-trips canonical snapshot payloads deterministically", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 1212 }),
        direction: "minimize",
        trials: 5,
        objective: singleObjective
      })

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)

      const decodedA = yield* Study.decodeStudySnapshot(snapshot)
      const decodedB = yield* Study.decodeStudySnapshot(snapshot)

      expect(decodedA).toEqual(decodedB)
      expect(decodedA.snapshotFormatVersion).toBe(1)
    }))

  it.effect("decodeStudySnapshot rejects legacy `version` payloads in prerelease format contract", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 8181 }),
        direction: "minimize",
        trials: 4,
        objective: singleObjective
      })

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const legacyPayload = legacyPayloadFromSnapshot(snapshot)
      const decoded = yield* Effect.either(Study.decodeStudySnapshot(legacyPayload))

      expect(Either.isLeft(decoded)).toBe(true)
    }))

  it.effect("Study.resume preserves trial continuity with canonical snapshot payload", () =>
    Effect.gen(function*() {
      const firstLeg = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 9090 }),
        direction: "minimize",
        trials: 4,
        objective: singleObjective
      })

      const firstSingle = asSingleObjective(firstLeg)
      expect(Option.isSome(firstSingle)).toBe(true)

      if (Option.isNone(firstSingle)) {
        return
      }

      const firstSnapshot = yield* Study.snapshot(firstSingle.value)

      const resumed = yield* Study.resume({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 9090 }),
        snapshot: firstSnapshot,
        direction: "minimize",
        trials: 3,
        objective: singleObjective
      })

      const resumedSingle = asSingleObjective(resumed)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      const resumedSnapshot = yield* Study.snapshot(resumedSingle.value)
      expect(resumedSnapshot.snapshotFormatVersion).toBe(1)
      expect(resumedSingle.value.trials.map((trial) => trial.trialNumber)).toEqual([0, 1, 2, 3, 4, 5, 6])
    }))
})
