/**
 * Contract for typed review-sidecar normalization.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Redacted } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../../fixtures/open-agent-trace/pi-mono/index.js"

describe("OpenAgentTrace/reviewSidecar", () => {
  it.effect("normalizes review-sidecar metadata into typed release-safety status", () =>
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

      expect(record.reviewStatus.aboutProject).toBe(true)
      expect(record.reviewStatus.shareable).toBe(true)
      expect(record.reviewStatus.missedSensitiveData).toBe(false)
      expect(Redacted.value(record.reviewStatus.reviewKey!)).toBe("review-key-public-corpus")
      expect(record.reviewStatus.promptVersion).toBe(3)
      expect(record.reviewStatus.semanticReviewStatus).toBe("approved")
      expect(record.reviewStatus.projectionSafe).toBe(true)
      expect(record.reviewStatus.manualReviewRequired).toBe(false)
    }))
})
