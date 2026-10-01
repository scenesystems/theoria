import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option } from "effect"

import * as Optimization from "../../src/Optimization.js"
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
} from "../helpers/optimizationSnapshots.js"

describe("Optimization snapshot-resume prune/stop replay", () => {
  it.effect("proves prune/report/stop semantic parity for uninterrupted vs resumed execution", () =>
    Effect.gen(function*() {
      const totalTrials = 8
      const firstLegTrials = 3
      const secondLegTrials = Num.subtract(totalTrials, firstLegTrials)
      const runOptions: Optimization.Options = {
        space: yield* pruneStopSpace,
        sampler: pruneStopSampler,
        direction: "minimize",
        trials: totalTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      }

      const baselineResult = yield* Optimization.run(runOptions)
      const baselineSingle = snapshotSingleObjectiveResult(baselineResult)
      expect(Option.isSome(baselineSingle)).toBe(true)
      const baseline = yield* baselineSingle

      const baselineEvents = yield* collectSnapshotEvents(runOptions)
      const firstLegResult = yield* Optimization.run({
        ...runOptions,
        trials: firstLegTrials
      })
      const firstLegSingle = snapshotSingleObjectiveResult(firstLegResult)
      expect(Option.isSome(firstLegSingle)).toBe(true)
      const firstLeg = yield* firstLegSingle

      const snapshot = yield* Optimization.snapshot(firstLeg)
      const resumedResult = yield* Optimization.resume({
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
      const resumed = yield* resumedSingle

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

      expect(resumed.completionReason).toBe("interrupted")
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.map(Arr.fromIterable(baseline.trials), (trial) => trial.trialNumber)
      )
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.state._tag)).toEqual(
        Arr.map(Arr.fromIterable(baseline.trials), (trial) => trial.state._tag)
      )
      expect(resumed.bestTrial.trialNumber).toBe(baseline.bestTrial.trialNumber)
      expect(snapshotEventTrace(baselineTail)).toEqual(snapshotEventTrace(resumedWithEventLog.events))
    }))
})
