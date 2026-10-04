import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Stream, Struct } from "effect"

import * as Optimization from "../../src/Optimization.js"
import {
  baselineSnapshotTailEvents,
  pruneStopObjective,
  pruneStopPolicy,
  pruneStopSampler,
  pruneStopSpace,
  snapshotEventTrace,
  snapshotSingleObjectiveResult
} from "../helpers/optimizationSnapshots.js"

describe("Optimization snapshot-resume prune/stop replay", () => {
  it.effect("proves prune/report/stop semantic parity for uninterrupted vs resumed execution", () =>
    Effect.gen(function*() {
      const totalTrials = 8
      const firstLegTrials = 3
      const secondLegTrials = Num.subtract(totalTrials, firstLegTrials)
      const runOptions = new Optimization.FlatOptions({
        space: yield* pruneStopSpace,
        sampler: pruneStopSampler,
        direction: "minimize",
        trials: totalTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      })

      const baselineResult = yield* Optimization.run(runOptions)
      const baselineSingle = snapshotSingleObjectiveResult(baselineResult)
      expect(Option.isSome(baselineSingle)).toBe(true)
      const baseline = yield* Effect.fromOption(baselineSingle)

      const baselineEvents = yield* Stream.runCollect(Optimization.stream(runOptions))
      const firstLegResult = yield* Optimization.run(
        new Optimization.FlatOptions(Struct.assign(runOptions, {
          trials: firstLegTrials
        }))
      )
      const firstLegSingle = snapshotSingleObjectiveResult(firstLegResult)
      expect(Option.isSome(firstLegSingle)).toBe(true)
      const firstLeg = yield* Effect.fromOption(firstLegSingle)

      const snapshot = yield* Optimization.snapshot(firstLeg)
      const resumedResult = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space: yield* pruneStopSpace,
          sampler: pruneStopSampler,
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          stopMode: "Drain",
          pruningPolicy: pruneStopPolicy,
          objective: pruneStopObjective
        })
      )
      const resumedSingle = snapshotSingleObjectiveResult(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)
      const resumed = yield* Effect.fromOption(resumedSingle)

      const resumedEvents = yield* Stream.runCollect(Optimization.resumeStream(
        new Optimization.ResumeOptions({
          space: yield* pruneStopSpace,
          sampler: pruneStopSampler,
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          stopMode: "Drain",
          pruningPolicy: pruneStopPolicy,
          objective: pruneStopObjective
        })
      ))

      const baselineTail = baselineSnapshotTailEvents(baselineEvents, firstLegTrials)

      expect(resumed.completionReason).toBe("interrupted")
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.map(Arr.fromIterable(baseline.trials), (trial) => trial.trialNumber)
      )
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.state._tag)).toEqual(
        Arr.map(Arr.fromIterable(baseline.trials), (trial) => trial.state._tag)
      )
      expect(resumed.bestTrial.trialNumber).toBe(baseline.bestTrial.trialNumber)
      expect(snapshotEventTrace(baselineTail)).toEqual(snapshotEventTrace(resumedEvents))
    }))
})
