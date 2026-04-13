/**
 * Example contract: Amp OpenAgentTrace projection story.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { loadPluginAdapterCapture } from "../../fixtures/open-agent-trace/amp/index.js"

describe("examples/23-open-agent-trace-amp", () => {
  it.effect("normalizes a checked-in Amp fixture and projects workflow plus coding evidence", () =>
    Effect.gen(function*() {
      const pluginCapture = yield* loadPluginAdapterCapture()
      const normalized = yield* Experimental.OpenAgentTrace.normalizeCapture(
        Experimental.OpenAgentTrace.Amp.pluginAdapter,
        pluginCapture
      )
      const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(normalized.record)
      const codingTask = Experimental.OpenAgentTrace.projectCodingTask(normalized.record)
      const codingEvidence = Experimental.OpenAgentTrace.projectCodingEvidence(normalized.record)

      expect(workflowProjection.workflowRecord.workflowKind).toBe("task-first")
      expect(codingTask.summary).toContain("formatCount(2)")
      expect(codingEvidence.commandCount).toBe(1)
      expect(normalized.coverageGaps.map((gap) => gap.sourceKind)).toEqual([
        "branch-lineage",
        "usage-provenance"
      ])
    }))
})
