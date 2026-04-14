/**
 * Contract for the shared open-agent-trace adapter schemas.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
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

describe("OpenAgentTrace/adapterSchema", () => {
  it.effect("decodes a source-agnostic adapter capture envelope", () =>
    Effect.gen(function*() {
      const capture = yield* Schema.decodeUnknown(Experimental.OpenAgentTrace.AdapterCapture)({
        captureId: "capture-1",
        source: {
          adapterKind: "amp-stream-json",
          sourceId: "amp-thread-export",
          sourceRevision: "v1",
          sourceUrl: "https://ampcode.com/threads/T-example",
          licenseTag: "workspace-private",
          harness: "amp-cli",
          sessionId: "T-example"
        },
        payload: { messages: [{ role: "user", text: "analyze this repo" }] },
        capturedAt: "2026-04-12T12:00:00.000Z"
      })

      expect(capture.source.adapterKind).toBe("amp-stream-json")
      expect(capture.source.sessionId).toBe("T-example")
    }))

  it.effect("decodes a normalization envelope containing a normalized record and explicit coverage gaps", () =>
    Effect.gen(function*() {
      const record = yield* normalizedRecordFixture
      const envelope = yield* Schema.decodeUnknown(Experimental.OpenAgentTrace.AdapterNormalizationEnvelope)({
        record,
        coverageGaps: [
          {
            gapId: "gap-1",
            sourceKind: "branch-lineage",
            sourceRef: { threadId: "T-example" },
            reason: "Source capture does not expose explicit branch ancestry.",
            severity: "warning"
          }
        ]
      })

      expect(envelope.record).toStrictEqual(record)
      expect(envelope.coverageGaps).toHaveLength(1)
      expect(envelope.coverageGaps[0]?.sourceKind).toBe("branch-lineage")
    }))

  it.effect("rejects unknown adapter kinds outside the declared source family", () =>
    Effect.gen(function*() {
      const exit = yield* Schema.decodeUnknown(Experimental.OpenAgentTrace.AdapterCapture)({
        captureId: "capture-2",
        source: {
          adapterKind: "amp-webhook",
          sourceId: "amp-thread-export",
          sourceRevision: "v1",
          sourceUrl: "https://ampcode.com/threads/T-example",
          licenseTag: "workspace-private",
          harness: "amp-cli",
          sessionId: "T-example"
        },
        payload: {},
        capturedAt: "2026-04-12T12:00:00.000Z"
      }).pipe(Effect.exit)

      expect(exit._tag).toBe("Failure")
    }))
})
