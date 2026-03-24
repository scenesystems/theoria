import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

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

      const initialSingle = asSingleObjective(initialResult)
      expect(Option.isSome(initialSingle)).toBe(true)

      if (Option.isNone(initialSingle)) {
        return
      }

      const snapshot = yield* Study.snapshot(initialSingle.value)

      expect(snapshot.snapshotFormatVersion).toBe(1)
      expect(snapshot.spaceFingerprint).toBeDefined()
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

      const resumedSingle = asSingleObjective(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(resumedSingle.value.trials).toHaveLength(10)
      expect(resumedSingle.value.trials.map((trial) => trial.trialNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(resumedSingle.value.bestTrial.state.value).toBeLessThanOrEqual(initialSingle.value.bestTrial.state.value)
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

      const baselineSingle = asSingleObjective(baselineResult)
      const firstLegSingle = asSingleObjective(firstLegResult)
      expect(Option.isSome(baselineSingle)).toBe(true)
      expect(Option.isSome(firstLegSingle)).toBe(true)

      if (Option.isNone(baselineSingle) || Option.isNone(firstLegSingle)) {
        return
      }

      const snapshot = yield* Study.snapshot(firstLegSingle.value)
      const resumedResult = yield* Study.resume({
        space: makeSpace(),
        sampler: Sampler.random({ seed }),
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        objective: singleObjective
      })
      const resumedSingle = asSingleObjective(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(encodeConfigTrace(singleConfigTrace(resumedSingle.value))).toBe(
        encodeConfigTrace(singleConfigTrace(baselineSingle.value))
      )
      expect(encodeNumericTrace(singleValueTrace(resumedSingle.value))).toBe(
        encodeNumericTrace(singleValueTrace(baselineSingle.value))
      )
      expect(resumedSingle.value.bestTrial.trialNumber).toBe(baselineSingle.value.bestTrial.trialNumber)
      expect(resumedSingle.value.bestTrial.state.value).toBe(baselineSingle.value.bestTrial.state.value)
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

      const baselineSingle = asSingleObjective(baselineResult)
      const firstLegSingle = asSingleObjective(firstLegResult)
      expect(Option.isSome(baselineSingle)).toBe(true)
      expect(Option.isSome(firstLegSingle)).toBe(true)

      if (Option.isNone(baselineSingle) || Option.isNone(firstLegSingle)) {
        return
      }

      const snapshot = yield* Study.snapshot(firstLegSingle.value)
      const resumedResult = yield* Study.resume({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        objective: singleObjective
      })
      const resumedSingle = asSingleObjective(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(encodeConfigTrace(singleConfigTrace(resumedSingle.value))).toBe(
        encodeConfigTrace(singleConfigTrace(baselineSingle.value))
      )
      expect(encodeNumericTrace(singleValueTrace(resumedSingle.value))).toBe(
        encodeNumericTrace(singleValueTrace(baselineSingle.value))
      )
      expect(resumedSingle.value.bestTrial.trialNumber).toBe(baselineSingle.value.bestTrial.trialNumber)
      expect(resumedSingle.value.bestTrial.state.value).toBe(baselineSingle.value.bestTrial.state.value)
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

      const baselineMulti = asMultiObjective(baselineResult)
      const firstLegMulti = asMultiObjective(firstLegResult)
      expect(Option.isSome(baselineMulti)).toBe(true)
      expect(Option.isSome(firstLegMulti)).toBe(true)

      if (Option.isNone(baselineMulti) || Option.isNone(firstLegMulti)) {
        return
      }

      const snapshot = yield* Study.snapshot(firstLegMulti.value)
      const resumedResult = yield* Study.resume({
        space: makeMultiSpace(),
        sampler: Sampler.tpe(options),
        snapshot,
        directions: ["minimize", "minimize"],
        trials: secondLegTrials,
        objective: objectiveVector
      })
      const resumedMulti = asMultiObjective(resumedResult)
      expect(Option.isSome(resumedMulti)).toBe(true)

      if (Option.isNone(resumedMulti)) {
        return
      }

      expect(encodeMultiConfigTrace(multiConfigTrace(resumedMulti.value))).toBe(
        encodeMultiConfigTrace(multiConfigTrace(baselineMulti.value))
      )
      expect(encodeObjectiveVectorTrace(multiValueTrace(resumedMulti.value))).toBe(
        encodeObjectiveVectorTrace(multiValueTrace(baselineMulti.value))
      )
      expect(resumedMulti.value.paretoFront.map((trial) => trial.trialNumber)).toEqual(
        baselineMulti.value.paretoFront.map((trial) => trial.trialNumber)
      )
      expect(encodeObjectiveVectorTrace(multiParetoValueTrace(resumedMulti.value))).toBe(
        encodeObjectiveVectorTrace(multiParetoValueTrace(baselineMulti.value))
      )
    }))
})
