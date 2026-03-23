import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Errors from "../../../src/Errors/index.js"
import * as Study from "../../../src/Study/index.js"
import * as StudyEvent from "../../../src/StudyEvent/index.js"

describe("terminal reporter event rendering", () => {
  it.effect("renders deterministic event lines for completed, best, pruned, failed, and completion variants", () =>
    Effect.gen(function*() {
      const completed = StudyEvent.TrialCompleted({ trialNumber: 4, value: [0.25, 1.5] })
      const bestUpdated = StudyEvent.BestUpdated({ trialNumber: 4, value: 0.25 })
      const pruned = StudyEvent.TrialPruned({
        trialNumber: 6,
        step: 2,
        reason: "threshold",
        policy: "threshold-pruner"
      })
      const failed = StudyEvent.TrialFailed({
        trialNumber: 7,
        error: new Errors.TrialError({
          trialNumber: 7,
          message: "objective crashed",
          cause: "synthetic"
        })
      })
      const completedStudy = StudyEvent.StudyCompleted({ completionReason: "budgetExhausted" })

      expect(Study.formatTerminalProgressEvent(completed, { renderMode: "plain" })).toEqual([
        new Study.ProgressLine({
          channel: "stdout",
          text: "trial#4 completed value=[0.25, 1.5]"
        })
      ])

      expect(Study.formatTerminalProgressEvent(bestUpdated, { renderMode: "plain" })).toEqual([
        new Study.ProgressLine({
          channel: "stdout",
          text: "best-updated trial#4 value=0.25"
        })
      ])

      expect(Study.formatTerminalProgressEvent(pruned, { renderMode: "plain" })).toEqual([
        new Study.ProgressLine({
          channel: "stdout",
          text: "trial#6 pruned step=2 policy=threshold-pruner reason=threshold"
        })
      ])

      expect(Study.formatTerminalProgressEvent(failed, { renderMode: "plain" })).toEqual([
        new Study.ProgressLine({
          channel: "stderr",
          text: "trial#7 failed error=effect-search/TrialError message=objective crashed"
        })
      ])

      expect(Study.formatTerminalProgressEvent(completedStudy, { renderMode: "plain" })).toEqual([
        new Study.ProgressLine({
          channel: "stdout",
          text: "study completed reason=budgetExhausted"
        })
      ])

      expect(Study.formatTerminalProgressEvent(pruned, { renderMode: "plain" })).toEqual(
        Study.formatTerminalProgressEvent(pruned, { renderMode: "plain" })
      )
    }))
})
