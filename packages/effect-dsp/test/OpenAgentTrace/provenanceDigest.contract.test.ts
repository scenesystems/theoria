/**
 * Contract for canonical digest provenance over normalized traces.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Redacted } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/provenanceDigest", () => {
  it.effect("derives stable record and corpus digests from canonical content rather than manifest pass-through values", () =>
    Effect.gen(function*() {
      const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
      const reviewSidecar = yield* Experimental.OpenAgentTrace.PiMono.decodeReviewSidecar(
        piShareHfReviewSidecarFixture
      )
      const row = yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture)
      const record = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry,
        reviewSidecar
      })
      const replay = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry,
        reviewSidecar
      })
      const changedReviewRecord = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry,
        reviewSidecar: { ...reviewSidecar, prompt_version: 4 }
      })
      const changedReviewKeyRecord = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry,
        reviewSidecar: { ...reviewSidecar, review_key: Redacted.make("different-review-key") }
      })
      const digests = yield* Experimental.OpenAgentTrace.digestRecord(record)
      const manifest = yield* Experimental.OpenAgentTrace.CorpusManifest.fromRecords({
        corpusId: "pi-mono-public-corpus",
        adapterId: "pi-mono",
        adapterVersion: "1",
        normalizationVersion: "1",
        projectionVersion: "not-projected",
        generatedAt: "2026-04-06T12:00:00.000Z",
        records: [record]
      })
      const replayManifest = yield* Experimental.OpenAgentTrace.CorpusManifest.fromRecords({
        corpusId: "pi-mono-public-corpus",
        adapterId: "pi-mono",
        adapterVersion: "1",
        normalizationVersion: "1",
        projectionVersion: "not-projected",
        generatedAt: "2026-04-06T12:00:00.000Z",
        records: [replay]
      })

      expect(replay).toStrictEqual(record)
      expect(record.sourceDigest).toStrictEqual(digests.sourceDigest)
      expect(record.normalizedDigest).toStrictEqual(digests.normalizedDigest)
      expect(record.redactedDigest).toStrictEqual(digests.redactedDigest)
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.sourceDigest)).toContain(
        "blake3-256:"
      )
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.normalizedDigest)).toContain(
        "blake3-256:"
      )
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.redactedDigest)).toContain(
        "blake3-256:"
      )
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.sourceDigest)).not.toBe(
        manifestEntry.source_hash
      )
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(record.redactedDigest)).not.toBe(
        manifestEntry.redacted_hash
      )
      expect(changedReviewRecord.normalizedDigest).not.toBe(record.normalizedDigest)
      expect(changedReviewKeyRecord.normalizedDigest).toStrictEqual(record.normalizedDigest)
      expect(changedReviewKeyRecord.redactedDigest).toStrictEqual(record.redactedDigest)
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(digests.reviewStatusDigest)).toContain(
        "blake3-256:"
      )
      expect(manifest.corpusDigest).toStrictEqual(replayManifest.corpusDigest)
    }))
})
