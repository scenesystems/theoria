/**
 * Contract for typed assistant-usage provenance within projections.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piMonoTaskFirstRowFixture, piShareHfManifestFixture } from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/piUsageProjection", () => {
  it.effect("preserves provider, model, api, stop reason, cache token counts, and cost in typed provenance while folding cached status into the public usage sample", () =>
    Effect.gen(function*() {
      const manifestEntry = yield* Experimental.OpenAgentTrace.decodePiShareHfManifestEntry(piShareHfManifestFixture)
      const record = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row: yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(piMonoTaskFirstRowFixture),
        manifestEntry
      })
      const workflowProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToWorkflow(record)
      const firstUsage = workflowProjection.usageProvenance[0]

      expect(firstUsage?.eventId).toBe("00000004")
      expect(firstUsage?.provider).toBe("anthropic")
      expect(firstUsage?.model).toBe("claude-sonnet-4-5")
      expect(firstUsage?.api).toBe("anthropic")
      expect(firstUsage?.stopReason).toBe("stop")
      expect(firstUsage?.cacheReadTokens).toBe(16)
      expect(firstUsage?.cacheWriteTokens).toBe(4)
      expect(firstUsage?.costUsd).toBe(0.00294)
      expect(firstUsage?.usage.cached).toBe(true)
      expect(firstUsage?.usage.inputTokens).toBe(120)
      expect(firstUsage?.usage.outputTokens).toBe(80)
    }))
})
