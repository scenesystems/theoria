import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import * as Study from "../../../src/Study/index.js"
import {
  asSingleObjective,
  baselineTailEvents,
  collectEvents,
  deterministicSampler,
  eventTrace,
  pruneStopObjective,
  pruneStopPolicy,
  pruneStopSpace,
  resumeWithEvents
} from "./helpers.js"

describe("Study snapshot-resume prune/stop replay", () => {
  it.effect("proves prune/report/stop semantic parity for uninterrupted vs resumed execution", () =>
    Effect.gen(function*() {
      const totalTrials = 8
      const firstLegTrials = 3
      const secondLegTrials = totalTrials - firstLegTrials
      const runOptions: Study.OptimizeOptions = {
        space: pruneStopSpace,
        sampler: deterministicSampler,
        direction: "minimize",
        trials: totalTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      }

      const baselineResult = yield* Study.optimize(runOptions)
      const baselineSingle = asSingleObjective(baselineResult)
      expect(Option.isSome(baselineSingle)).toBe(true)

      if (Option.isNone(baselineSingle)) {
        return
      }

      const baselineEvents = yield* collectEvents(runOptions)
      const firstLegResult = yield* Study.optimize({
        ...runOptions,
        trials: firstLegTrials
      })
      const firstLegSingle = asSingleObjective(firstLegResult)
      expect(Option.isSome(firstLegSingle)).toBe(true)

      if (Option.isNone(firstLegSingle)) {
        return
      }

      const snapshot = yield* Study.snapshot(firstLegSingle.value)
      const resumedResult = yield* Study.resume({
        space: pruneStopSpace,
        sampler: deterministicSampler,
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      })
      const resumedSingle = asSingleObjective(resumedResult)
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      const resumedWithEventLog = yield* resumeWithEvents({
        space: pruneStopSpace,
        sampler: deterministicSampler,
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        stopMode: "Drain",
        pruningPolicy: pruneStopPolicy,
        objective: pruneStopObjective
      })

      const baselineTail = baselineTailEvents(baselineEvents, firstLegTrials)

      expect(resumedSingle.value.completionReason).toBe("interrupted")
      expect(resumedSingle.value.trials.map((trial) => trial.trialNumber)).toEqual(
        baselineSingle.value.trials.map((trial) => trial.trialNumber)
      )
      expect(resumedSingle.value.trials.map((trial) => trial.state._tag)).toEqual(
        baselineSingle.value.trials.map((trial) => trial.state._tag)
      )
      expect(resumedSingle.value.bestTrial.trialNumber).toBe(baselineSingle.value.bestTrial.trialNumber)
      expect(eventTrace(baselineTail)).toEqual(eventTrace(resumedWithEventLog.events))
    }))
})
