/**
 * Contract for Amp adapter normalization into canonical OpenAgentTrace records.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  loadPluginAdapterCapture,
  loadStreamJsonAdapterCapture,
  threadId
} from "../../fixtures/open-agent-trace/amp/index.js"

describe("OpenAgentTrace/ampAdapter", () => {
  it.effect("normalizes both Plugin API and stream-json captures into the canonical record family with explicit coverage gaps", () =>
    Effect.gen(function*() {
      const pluginCapture = yield* loadPluginAdapterCapture()
      const streamJsonCapture = yield* loadStreamJsonAdapterCapture()
      const plugin = yield* Experimental.OpenAgentTrace.normalizeCapture(
        Experimental.OpenAgentTrace.Amp.pluginAdapter,
        pluginCapture
      )
      const streamJson = yield* Experimental.OpenAgentTrace.normalizeCapture(
        Experimental.OpenAgentTrace.Amp.streamJsonAdapter,
        streamJsonCapture
      )
      const codingTask = Experimental.OpenAgentTrace.projectCodingTask(streamJson.record)
      const codingEvidence = Experimental.OpenAgentTrace.projectCodingEvidence(streamJson.record)

      expect(plugin.record.source.sessionId).toBe(threadId)
      expect(plugin.record.source.fileName).toBe("plugin.raw.json")
      expect(streamJson.record.source.fileName).toBe("stream-json.raw.jsonl")
      expect(plugin.record.source.sourceUrl).toContain(threadId)
      expect(plugin.coverageGaps.map((gap) => gap.sourceKind)).toEqual([
        "branch-lineage",
        "usage-provenance"
      ])
      expect(streamJson.coverageGaps.map((gap) => gap.sourceKind)).toEqual(["branch-lineage"])
      expect(plugin.record.events.some((event) => event.eventKind === "bash-execution")).toBe(true)
      expect(streamJson.record.events.some((event) => event.eventKind === "bash-execution")).toBe(true)
      expect(codingTask.summary).toContain("formatCount(2)")
      expect(codingEvidence.commandCount).toBeGreaterThan(0)
    }))
})
