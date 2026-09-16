import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"

import * as Sampler from "../../src/Sampler.js"
import * as Study from "../../src/Study.js"
import * as StudySnapshot from "../../src/StudySnapshot.js"
import {
  encodeMultiObjectiveConfigTrace,
  encodeObjectiveVectorTrace,
  encodeSnapshotConfigTrace,
  encodeSnapshotValueTrace,
  multiObjectiveConfigTrace,
  multiObjectiveSnapshotSpace,
  multiObjectiveValueTrace,
  paretoObjectiveValueTrace,
  snapshotConfigTrace,
  snapshotMultiObjectiveResult,
  snapshotObjectiveVector,
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace,
  snapshotValueTrace
} from "../helpers/studySnapshots.js"

describe("Study snapshot-resume metadata and replay parity", () => {
  it.effect("captures canonical snapshot metadata and continues trial numbering", () =>
    Effect.gen(function*() {
      const seed = 501
      const space = yield* snapshotSpace
      const sampler = Sampler.random({ seed })
      const initialResult = yield* Study.optimize({
        space,
        sampler,
        direction: "minimize",
        trials: 6,
        objective: snapshotSingleObjective
      })

      const initialSingle = yield* snapshotSingleObjectiveResult(initialResult)

      const snapshot = yield* Study.snapshot(initialSingle)

      expect(snapshot.snapshotFormatVersion).toBe(1)
      expect(snapshot.spaceFingerprint.length).toBeGreaterThan(0)
      expect(snapshot.objectiveSpec._tag).toBe("Single")
      expect(snapshot.stopMode).toBe("Drain")
      expect(snapshot.samplerKind._tag).toBe("Random")
      expect(snapshot.samplerCheckpoint._tag).toBe("Random")
      expect(snapshot.nextTrialNumber).toBe(6)
      expect(snapshot.completedCount).toBe(6)

      const metadata = yield* Schema.decodeUnknown(StudySnapshot.Metadata)({
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
        objective: snapshotSingleObjective
      })

      const resumedSingle = yield* snapshotSingleObjectiveResult(resumedResult)

      expect(resumedSingle.trials).toHaveLength(10)
      expect(Arr.map(Arr.fromIterable(resumedSingle.trials), (trial) => trial.trialNumber)).toEqual([
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9
      ])
      expect(resumedSingle.bestTrial.state.value).toBeLessThanOrEqual(initialSingle.bestTrial.state.value)
    }))

  it.effect("proves deterministic parity for random sampler N+M replay", () =>
    Effect.gen(function*() {
      const seed = 991
      const totalTrials = 12
      const firstLegTrials = 7
      const secondLegTrials = totalTrials - firstLegTrials
      const baselineResult = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: totalTrials,
        objective: snapshotSingleObjective
      })
      const firstLegResult = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        direction: "minimize",
        trials: firstLegTrials,
        objective: snapshotSingleObjective
      })

      const baselineSingle = yield* snapshotSingleObjectiveResult(baselineResult)
      const firstLegSingle = yield* snapshotSingleObjectiveResult(firstLegResult)

      const snapshot = yield* Study.snapshot(firstLegSingle)
      const resumedResult = yield* Study.resume({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed }),
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        objective: snapshotSingleObjective
      })
      const resumedSingle = yield* snapshotSingleObjectiveResult(resumedResult)

      expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(resumedSingle))).toBe(
        encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baselineSingle))
      )
      expect(encodeSnapshotValueTrace(snapshotValueTrace(resumedSingle))).toBe(
        encodeSnapshotValueTrace(snapshotValueTrace(baselineSingle))
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
        space: yield* snapshotSpace,
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: totalTrials,
        objective: snapshotSingleObjective
      })
      const firstLegResult = yield* Study.optimize({
        space: yield* snapshotSpace,
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: firstLegTrials,
        objective: snapshotSingleObjective
      })

      const baselineSingle = yield* snapshotSingleObjectiveResult(baselineResult)
      const firstLegSingle = yield* snapshotSingleObjectiveResult(firstLegResult)

      const snapshot = yield* Study.snapshot(firstLegSingle)
      const resumedResult = yield* Study.resume({
        space: yield* snapshotSpace,
        sampler: Sampler.tpe(options),
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        objective: snapshotSingleObjective
      })
      const resumedSingle = yield* snapshotSingleObjectiveResult(resumedResult)

      expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(resumedSingle))).toBe(
        encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baselineSingle))
      )
      expect(encodeSnapshotValueTrace(snapshotValueTrace(resumedSingle))).toBe(
        encodeSnapshotValueTrace(snapshotValueTrace(baselineSingle))
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
        space: yield* multiObjectiveSnapshotSpace,
        sampler: Sampler.tpe(options),
        directions: ["minimize", "minimize"],
        trials: totalTrials,
        objective: snapshotObjectiveVector
      })
      const firstLegResult = yield* Study.optimize({
        space: yield* multiObjectiveSnapshotSpace,
        sampler: Sampler.tpe(options),
        directions: ["minimize", "minimize"],
        trials: firstLegTrials,
        objective: snapshotObjectiveVector
      })

      const baselineMulti = yield* snapshotMultiObjectiveResult(baselineResult)
      const firstLegMulti = yield* snapshotMultiObjectiveResult(firstLegResult)

      const snapshot = yield* Study.snapshot(firstLegMulti)
      const resumedResult = yield* Study.resume({
        space: yield* multiObjectiveSnapshotSpace,
        sampler: Sampler.tpe(options),
        snapshot,
        directions: ["minimize", "minimize"],
        trials: secondLegTrials,
        objective: snapshotObjectiveVector
      })
      const resumedMulti = yield* snapshotMultiObjectiveResult(resumedResult)

      expect(encodeMultiObjectiveConfigTrace(yield* multiObjectiveConfigTrace(resumedMulti))).toBe(
        encodeMultiObjectiveConfigTrace(yield* multiObjectiveConfigTrace(baselineMulti))
      )
      expect(encodeObjectiveVectorTrace(multiObjectiveValueTrace(resumedMulti))).toBe(
        encodeObjectiveVectorTrace(multiObjectiveValueTrace(baselineMulti))
      )
      expect(Arr.map(Arr.fromIterable(resumedMulti.paretoFront), (trial) => trial.trialNumber)).toEqual(
        Arr.map(Arr.fromIterable(baselineMulti.paretoFront), (trial) => trial.trialNumber)
      )
      expect(encodeObjectiveVectorTrace(paretoObjectiveValueTrace(resumedMulti))).toBe(
        encodeObjectiveVectorTrace(paretoObjectiveValueTrace(baselineMulti))
      )
    }))
})
