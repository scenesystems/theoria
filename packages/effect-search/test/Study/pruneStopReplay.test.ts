import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import * as Study from "../../src/Study.js"
import {
  baselineSnapshotTailEvents,
  collectSnapshotEvents,
  pruneStopObjective,
  pruneStopPolicy,
  pruneStopSampler,
  pruneStopSpace,
  resumeSnapshotWithEvents,
  snapshotEventTrace,
  snapshotSingleObjectiveResult
} from "../helpers/studySnapshots.js"

describe("Study snapshot-resume prune/stop replay", () => {
  it.effect("proves prune/report/stop semantic parity for uninterrupted vs resumed execution", () =>
    Effect.gen(function*() {
      const totalTrials = 8
      const firstLegTrials = 3
      const secondLegTrials = totalTrials - firstLegTrials
      const runOptions: Study.Options = {
        space: yield* pruneStopSpace,
        sampler: pruneStopSampler,
        direction: "minimize",
        trials: totalTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      }

      const baselineResult = yield* Study.optimize(runOptions)
      const baselineSingle = snapshotSingleObjectiveResult(baselineResult)
      expect(Option.isSome(baselineSingle)).toBe(true)

      if (Option.isNone(baselineSingle)) {
        return
      }

      const baselineEvents = yield* collectSnapshotEvents(runOptions)
      const firstLegResult = yield* Study.optimize({
        ...runOptions,
        trials: firstLegTrials
      })
      const firstLegSingle = snapshotSingleObjectiveResult(firstLegResult)
      expect(Option.isSome(firstLegSingle)).toBe(true)

      if (Option.isNone(firstLegSingle)) {
        return
      }

      const snapshot = yield* Study.snapshot(firstLegSingle.value)
      const resumedResult = yield* Study.resume({
        space: yield* pruneStopSpace,
        sampler: pruneStopSampler,
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      })
      const resumedSingle = snapshotSingleObjectiveResult(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      const resumedWithEventLog = yield* resumeSnapshotWithEvents({
        space: yield* pruneStopSpace,
        sampler: pruneStopSampler,
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      })

      const baselineTail = baselineSnapshotTailEvents(baselineEvents, firstLegTrials)

      expect(resumedSingle.value.completionReason).toBe("interrupted")
      expect(Arr.map(Arr.fromIterable(resumedSingle.value.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.map(Arr.fromIterable(baselineSingle.value.trials), (trial) => trial.trialNumber)
      )
      expect(Arr.map(Arr.fromIterable(resumedSingle.value.trials), (trial) => trial.state._tag)).toEqual(
        Arr.map(Arr.fromIterable(baselineSingle.value.trials), (trial) => trial.state._tag)
      )
      expect(resumedSingle.value.bestTrial.trialNumber).toBe(baselineSingle.value.bestTrial.trialNumber)
      expect(snapshotEventTrace(baselineTail)).toEqual(snapshotEventTrace(resumedWithEventLog.events))
    }))
})
