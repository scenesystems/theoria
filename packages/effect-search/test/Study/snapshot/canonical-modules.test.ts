import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import * as Metadata from "../../../src/Study/snapshot/metadata.js"
import * as StateCodec from "../../../src/Study/snapshot/stateCodec.js"
import * as Versioning from "../../../src/Study/snapshot/versioning.js"
import { asSingleObjective, singleObjective, singleObjectiveSpace } from "./helpers.js"

describe("snapshot canonical modules", () => {
  it.effect("decodes snapshot payloads through versioning and validates metadata/trial schemas directly", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: singleObjectiveSpace,
        sampler: Sampler.random({ seed: 3310 }),
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
      const decoded = yield* Versioning.decodeStudySnapshot(snapshot)
      const decodedMetadata = Schema.decodeUnknownSync(Metadata.SnapshotMetadataSchema)({
        spaceFingerprint: decoded.spaceFingerprint,
        objectiveSpec: decoded.objectiveSpec,
        stopMode: decoded.stopMode,
        samplerKind: decoded.samplerKind,
        samplerCheckpoint: decoded.samplerCheckpoint
      })
      const decodedTrials = Schema.decodeUnknownSync(Schema.Array(StateCodec.SnapshotTrialSchema))(decoded.trials)

      expect(decoded.snapshotFormatVersion).toBe(1)
      expect(decodedMetadata.spaceFingerprint).toBe(decoded.spaceFingerprint)
      expect(decodedTrials).toEqual(decoded.trials)
    }))

  it.effect("rebuilds snapshots from canonical versioning constructors", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: singleObjectiveSpace,
        sampler: Sampler.random({ seed: 7781 }),
        direction: "minimize",
        trials: 5,
        objective: singleObjective
      })

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const canonicalSnapshot = Versioning.snapshotFromTrials(single.value.trials, single.value.snapshotMetadata)

      expect(canonicalSnapshot.nextTrialNumber).toBe(Versioning.nextTrialNumberFromTrials(single.value.trials))
      expect(canonicalSnapshot.completedCount).toBe(single.value.trials.length)
    }))
})
