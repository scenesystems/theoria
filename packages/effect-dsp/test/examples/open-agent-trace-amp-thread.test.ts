/**
 * Example contract: Amp thread OpenAgentTrace evidentiary import story.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { loadExportSnapshot, sourceUrl, threadId } from "../../fixtures/open-agent-trace/amp-thread/index.js"

describe("examples/25-open-agent-trace-amp-thread", () => {
  it.effect("normalizes a checked-in Amp thread export snapshot and projects workflow evidence with explicit coverage gaps", () =>
    Effect.gen(function*() {
      const snapshot = yield* loadExportSnapshot()
      const normalized = yield* Experimental.OpenAgentTrace.AmpThread.normalizeExportSnapshot({
        snapshot,
        sourceUrl
      })
      const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(normalized.record)

      expect(snapshot.id).toBe(threadId)
      expect(normalized.record.source.sourceUrl).toBe(sourceUrl)
      expect(workflowProjection.workflowRecord.session.sessionId).toBe(threadId.slice(2))
      expect(normalized.coverageGaps.map((gap) => gap.sourceKind)).toEqual([
        "tool-lifecycle",
        "hidden-runtime-data",
        "timestamp-authority",
        "usage-provenance",
        "file-contents",
        "branch-lineage"
      ])
      expect(workflowProjection.coverageGaps.map((gap) => gap.sourceKind)).toContain("bash-execution")
    }))
})
