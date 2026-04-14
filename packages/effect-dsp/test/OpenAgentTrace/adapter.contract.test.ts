/**
 * Contract for the shared open-agent-trace adapter constructor and normalize seam.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piMonoTaskFirstRowFixture, piShareHfManifestFixture } from "../../fixtures/open-agent-trace/pi-mono/index.js"

const normalizedRecordFixture = Effect.gen(function*() {
  const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
  const row = yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture)

  return yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
    datasetId: "badlogicgames/pi-mono",
    datasetRevision: "main",
    split: "train",
    sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
    licenseTag: "other",
    row,
    manifestEntry
  })
})

const customAdapterCapture = {
  captureId: "capture-custom-1",
  source: {
    adapterKind: "custom",
    sourceId: "fixture-source",
    sourceRevision: "v1",
    sourceUrl: "https://example.com/custom-source",
    licenseTag: "test-only",
    harness: "fixture",
    sessionId: "custom-session"
  },
  payload: { source: "fixture" },
  capturedAt: "2026-04-12T12:00:00.000Z"
}

describe("OpenAgentTrace/adapter", () => {
  it.effect("normalizes through the shared adapter constructor without source-specific branching in the consumer", () =>
    Effect.gen(function*() {
      const record = yield* normalizedRecordFixture
      const adapter = Experimental.OpenAgentTrace.makeAdapter({
        kind: "custom",
        normalize: () =>
          Effect.succeed({
            record,
            coverageGaps: []
          })
      })
      const result = yield* Experimental.OpenAgentTrace.normalizeCapture(
        adapter,
        customAdapterCapture
      )

      expect(result.record).toStrictEqual(record)
      expect(result.coverageGaps).toStrictEqual([])
    }))

  it.effect("preserves adapter-reported coverage gaps alongside the normalized record", () =>
    Effect.gen(function*() {
      const record = yield* normalizedRecordFixture
      const adapter = Experimental.OpenAgentTrace.makeAdapter({
        kind: "custom",
        normalize: () =>
          Effect.succeed({
            record,
            coverageGaps: [
              Experimental.OpenAgentTrace.AdapterCoverageGap.make({
                gapId: "gap-1",
                sourceKind: "usage-provenance",
                sourceRef: { sessionId: "custom-session" },
                reason: "Source capture does not expose per-turn usage samples.",
                severity: "info"
              })
            ]
          })
      })
      const result = yield* Experimental.OpenAgentTrace.normalizeCapture(
        adapter,
        customAdapterCapture
      )

      expect(result.record).toStrictEqual(record)
      expect(result.coverageGaps).toHaveLength(1)
      expect(result.coverageGaps[0]?.sourceKind).toBe("usage-provenance")
    }))

  it.effect("allows custom adapter kinds while still targeting the canonical OpenAgentTraceRecord", () =>
    Effect.gen(function*() {
      const record = yield* normalizedRecordFixture
      const adapter = Experimental.OpenAgentTrace.makeAdapter({
        kind: "custom",
        normalize: () =>
          Effect.succeed({
            record,
            coverageGaps: []
          })
      })
      const result = yield* Experimental.OpenAgentTrace.normalizeCapture(
        adapter,
        customAdapterCapture
      )

      expect(adapter.kind).toBe("custom")
      expect(result.record.recordId).toBe(record.recordId)
    }))
})
