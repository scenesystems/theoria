import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Progress from "../../src/Progress.js"
import * as SearchError from "../../src/SearchError.js"
import * as StudyEvent from "../../src/StudyEvent.js"

describe("terminal reporter event rendering", () => {
  it.effect("renders deterministic event lines for completed, best, pruned, failed, and completion variants", () =>
    Effect.gen(function*() {
      const completed = StudyEvent.trialCompleted({ trialNumber: 4, value: [0.25, 1.5] })
      const bestUpdated = StudyEvent.bestUpdated({ trialNumber: 4, value: 0.25 })
      const pruned = StudyEvent.trialPruned({
        trialNumber: 6,
        step: 2,
        reason: "threshold",
        policy: "threshold-pruner"
      })
      const failed = StudyEvent.trialFailed({
        trialNumber: 7,
        error: new SearchError.TrialError({
          trialNumber: 7,
          message: "objective crashed",
          cause: "synthetic"
        })
      })
      const completedStudy = StudyEvent.completed({ completionReason: "budgetExhausted" })

      expect(Progress.format(completed, "plain")).toEqual([
        new Progress.Line({
          channel: "stdout",
          text: "trial#4 completed value=[0.25, 1.5]"
        })
      ])

      expect(Progress.format(bestUpdated, "plain")).toEqual([
        new Progress.Line({
          channel: "stdout",
          text: "best-updated trial#4 value=0.25"
        })
      ])

      expect(Progress.format(pruned, "plain")).toEqual([
        new Progress.Line({
          channel: "stdout",
          text: "trial#6 pruned step=2 policy=threshold-pruner reason=threshold"
        })
      ])

      expect(Progress.format(failed, "plain")).toEqual([
        new Progress.Line({
          channel: "stderr",
          text: "trial#7 failed error=effect-search/TrialError message=objective crashed"
        })
      ])

      expect(Progress.format(completedStudy, "plain")).toEqual([
        new Progress.Line({
          channel: "stdout",
          text: "study completed reason=budgetExhausted"
        })
      ])

      expect(Progress.format(pruned, "plain")).toEqual(
        Progress.format(pruned, "plain")
      )
    }))
})
