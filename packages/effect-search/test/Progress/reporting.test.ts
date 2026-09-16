import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import * as OptimizationEvent from "../../src/OptimizationEvent.js"
import * as Progress from "../../src/Progress.js"
import * as SearchError from "../../src/SearchError.js"

describe("terminal reporter event rendering", () => {
  it.effect("renders deterministic event lines for completed, best, pruned, failed, and completion variants", () =>
    Effect.gen(function*() {
      const completed = OptimizationEvent.TrialCompleted({ trialNumber: 4, value: Arr.make(0.25, 1.5) })
      const bestUpdated = OptimizationEvent.BestUpdated({ trialNumber: 4, value: 0.25 })
      const pruned = OptimizationEvent.TrialPruned({
        trialNumber: 6,
        step: 2,
        reason: "threshold",
        policy: "threshold-pruner"
      })
      const failed = OptimizationEvent.TrialFailed({
        trialNumber: 7,
        error: new SearchError.TrialError({
          trialNumber: 7,
          message: "objective crashed",
          cause: "synthetic"
        })
      })
      const completedOptimization = OptimizationEvent.Completed({ completionReason: "budgetExhausted" })

      expect(Progress.format(completed, "plain")).toEqual(Arr.of(
        new Progress.Line({
          channel: "stdout",
          text: "trial#4 completed value=[0.25, 1.5]"
        })
      ))

      expect(Progress.format(bestUpdated, "plain")).toEqual(Arr.of(
        new Progress.Line({
          channel: "stdout",
          text: "best-updated trial#4 value=0.25"
        })
      ))

      expect(Progress.format(pruned, "plain")).toEqual(Arr.of(
        new Progress.Line({
          channel: "stdout",
          text: "trial#6 pruned step=2 policy=threshold-pruner reason=threshold"
        })
      ))

      expect(Progress.format(failed, "plain")).toEqual(Arr.of(
        new Progress.Line({
          channel: "stderr",
          text: "trial#7 failed error=effect-search/TrialError message=objective crashed"
        })
      ))

      expect(Progress.format(completedOptimization, "plain")).toEqual(Arr.of(
        new Progress.Line({
          channel: "stdout",
          text: "optimization completed reason=budgetExhausted"
        })
      ))

      expect(Progress.format(pruned, "plain")).toEqual(
        Progress.format(pruned, "plain")
      )
    }))
})
