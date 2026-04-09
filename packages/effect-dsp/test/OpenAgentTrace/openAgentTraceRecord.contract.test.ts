/**
 * Contract for deterministic `OpenAgentTraceRecord` normalization.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piMonoTaskFirstRowFixture, piShareHfManifestFixture } from "../../fixtures/open-agent-trace/pi-mono/index.js"

describe("OpenAgentTrace/openAgentTraceRecord", () => {
  it.effect("round-trips deterministically and preserves source lineage, branch topology, selection policy, ordered event identities, and the redacted_hash integrity chain", () =>
    Effect.gen(function*() {
      const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
      const row = yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture)
      const record = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry
      })
      const encoded = yield* Schema.encode(Experimental.OpenAgentTrace.OpenAgentTraceRecord)(record)
      const decoded = yield* Schema.decode(Experimental.OpenAgentTrace.OpenAgentTraceRecord)(encoded)
      const replay = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry
      })

      expect(decoded).toStrictEqual(record)
      expect(replay).toStrictEqual(record)
      expect(record.source.sessionId).toBe(row.session_id)
      expect(record.selection.selectionPolicy).toBe("latest-leaf")
      expect(record.branches[0]?.leafEntryId).toBe("00000006")
      expect(record.events.map((event) => event.eventId)).toEqual([
        "0000000a",
        "00000004",
        "00000007",
        "00000009",
        "0000000b",
        "0000000c",
        "0000000d",
        "0000000e"
      ])
      expect(record.coverageGaps).toStrictEqual([])
      expect(record.redactionFindings).toStrictEqual([])
      expect(record.reviewStatus.manualReviewRequired).toBe(true)
      expect(record.reviewStatus.projectionSafe).toBe(false)
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.sourceDigest)).toContain(
        "blake3-256:"
      )
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.redactedDigest)).toContain(
        "blake3-256:"
      )
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.normalizedDigest)).toContain(
        "blake3-256:"
      )
      expect(record.source.redactionKey).toBe(manifestEntry.redaction_key)
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.source.redactedHash)).toBe(
        manifestEntry.redacted_hash
      )
    }))
})
