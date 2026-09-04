import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import {
  asMultiObjective,
  asSingleObjective,
  encodeConfigTrace,
  encodeMultiConfigTrace,
  encodeNumericTrace,
  encodeObjectiveVectorTrace,
  makeMultiSpace,
  makeSpace,
  multiConfigTrace,
  multiParetoValueTrace,
  multiValueTrace,
  objectiveVector,
  singleConfigTrace,
  singleObjective,
  singleValueTrace
} from "./helpers.js"

describe("Study snapshot-resume metadata and replay parity", () => {
  it.effect("captures canonical snapshot metadata and continues trial numbering", () =>
    Effect.gen(function*() {
      const seed = 501
      const space = makeSpace()
      const sampler = Sampler.random({ seed })
      const initialResult = yield* Study.optimize({
        space,
        sampler,
        direction: "minimize",
        trials: 6,
        objective: singleObjective
      })

      const initialSingle = yield* asSingleObjective(initialResult)

      const snapshot = yield* Study.snapshot(initialSingle)

      expect(snapshot.snapshotFormatVersion).toBe(1)
      expect(snapshot.spaceFingerprint.length).toBeGreaterThan(0)
      expect(snapshot.objectiveSpec._tag).toBe("Single")
      expect(snapshot.stopMode).toBe("Drain")
      expect(snapshot.samplerKind._tag).toBe("Random")
      expect(snapshot.samplerCheckpoint._tag).toBe("Random")
      expect(snapshot.nextTrialNumber).toBe(6)
      expect(snapshot.completedCount).toBe(6)

      const metadata = Schema.decodeUnknownSync(Study.SnapshotMetadataSchema)({
        spaceFingerprint: snapshot.spaceFingerprint,
        objectiveSpec: snapshot.objectiveSpec,
        stopMode: snapshot.stopMode,
        samplerKind: snapshot.samplerKind,
        samplerCheckpoint: snapshot.samplerCheckpoint
      })
      expect(metadata.spaceFingerprint).toBe(snapshot.spaceFingerprint)

      const resumedResult = yield* Study.resume({
        space,
        sampler,
        snapshot,
        direction: "minimize",
        trials: 4,
        objective: singleObjective
      })

      const resumedSingle = yield* asSingleObjective(resumedResult)

      expect(resumedSingle.trials).toHaveLength(10)
      expect(resumedSingle.trials.map((trial) => trial.trialNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(resumedSingle.bestTrial.state.value).toBeLessThanOrEqual(initialSingle.bestTrial.state.value)
    }))

  it.effect("proves deterministic parity for random sampler N+M replay", () =>
    Effect.gen(function*() {
      const seed = 991
      const totalTrials = 12
      const firstLegTrials = 7
      const secondLegTrials = totalTrials - firstLegTrials
      const baselineResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: totalTrials,
        objective: singleObjective
      })
      const firstLegResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: firstLegTrials,
        objective: singleObjective
      })

      const baselineSingle = yield* asSingleObjective(baselineResult)
      const firstLegSingle = yield* asSingleObjective(firstLegResult)

      const snapshot = yield* Study.snapshot(firstLegSingle)
      const resumedResult = yield* Study.resume({
        space: makeSpace(),
        sampler: Sampler.random({ seed }),
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        objective: singleObjective
      })
      const resumedSingle = yield* asSingleObjective(resumedResult)

      expect(encodeConfigTrace(singleConfigTrace(resumedSingle))).toBe(
        encodeConfigTrace(singleConfigTrace(baselineSingle))
      )
      expect(encodeNumericTrace(singleValueTrace(resumedSingle))).toBe(
        encodeNumericTrace(singleValueTrace(baselineSingle))
      )
      expect(resumedSingle.bestTrial.trialNumber).toBe(baselineSingle.bestTrial.trialNumber)
      expect(resumedSingle.bestTrial.state.value).toBe(baselineSingle.bestTrial.state.value)
    }))

  it.effect("proves deterministic parity for single-objective TPE N+M replay", () =>
    Effect.gen(function*() {
      const options = {
        seed: 313,
        nStartupTrials: 4,
        nEiCandidates: 16
      }
      const totalTrials = 8
      const firstLegTrials = 5
      const secondLegTrials = totalTrials - firstLegTrials
      const baselineResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: totalTrials,
        objective: singleObjective
      })
      const firstLegResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: firstLegTrials,
        objective: singleObjective
      })

      const baselineSingle = yield* asSingleObjective(baselineResult)
      const firstLegSingle = yield* asSingleObjective(firstLegResult)

      const snapshot = yield* Study.snapshot(firstLegSingle)
      const resumedResult = yield* Study.resume({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        objective: singleObjective
      })
      const resumedSingle = yield* asSingleObjective(resumedResult)

      expect(encodeConfigTrace(singleConfigTrace(resumedSingle))).toBe(
        encodeConfigTrace(singleConfigTrace(baselineSingle))
      )
      expect(encodeNumericTrace(singleValueTrace(resumedSingle))).toBe(
        encodeNumericTrace(singleValueTrace(baselineSingle))
      )
      expect(resumedSingle.bestTrial.trialNumber).toBe(baselineSingle.bestTrial.trialNumber)
      expect(resumedSingle.bestTrial.state.value).toBe(baselineSingle.bestTrial.state.value)
    }))

  it.effect("proves deterministic parity for multi-objective TPE N+M replay", () =>
    Effect.gen(function*() {
      const options = {
        seed: 404,
        nStartupTrials: 4,
        nEiCandidates: 16
      }
      const totalTrials = 8
      const firstLegTrials = 5
      const secondLegTrials = totalTrials - firstLegTrials
      const baselineResult = yield* Study.optimize({
        space: makeMultiSpace(),
        sampler: Sampler.tpe(options),
        directions: ["minimize", "minimize"],
        trials: totalTrials,
        objective: objectiveVector
      })
      const firstLegResult = yield* Study.optimize({
        space: makeMultiSpace(),
        sampler: Sampler.tpe(options),
        directions: ["minimize", "minimize"],
        trials: firstLegTrials,
        objective: objectiveVector
      })

      const baselineMulti = yield* asMultiObjective(baselineResult)
      const firstLegMulti = yield* asMultiObjective(firstLegResult)

      const snapshot = yield* Study.snapshot(firstLegMulti)
      const resumedResult = yield* Study.resume({
        space: makeMultiSpace(),
        sampler: Sampler.tpe(options),
        snapshot,
        directions: ["minimize", "minimize"],
        trials: secondLegTrials,
        objective: objectiveVector
      })
      const resumedMulti = yield* asMultiObjective(resumedResult)

      expect(encodeMultiConfigTrace(multiConfigTrace(resumedMulti))).toBe(
        encodeMultiConfigTrace(multiConfigTrace(baselineMulti))
      )
      expect(encodeObjectiveVectorTrace(multiValueTrace(resumedMulti))).toBe(
        encodeObjectiveVectorTrace(multiValueTrace(baselineMulti))
      )
      expect(resumedMulti.paretoFront.map((trial) => trial.trialNumber)).toEqual(
        baselineMulti.paretoFront.map((trial) => trial.trialNumber)
      )
      expect(encodeObjectiveVectorTrace(multiParetoValueTrace(resumedMulti))).toBe(
        encodeObjectiveVectorTrace(multiParetoValueTrace(baselineMulti))
      )
    }))
})
