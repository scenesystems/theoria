/**
 * Contract for signed public corpus manifests.
 */
import { describe, expect, it } from "@effect/vitest"
import { generateKeyPair } from "@scenesystems/sign"
import { Effect, Redacted } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/signedCorpusManifest", () => {
  it.effect("signs and verifies public manifests over canonical schema bytes without letting private review keys perturb the manifest identity", () =>
    Effect.gen(function*() {
      const keys = yield* generateKeyPair("ed25519")
      const manifestEntry = yield* Experimental.OpenAgentTrace.decodePiShareHfManifestEntry(piShareHfManifestFixture)
      const reviewSidecar = yield* Experimental.OpenAgentTrace.decodePiShareHfReviewSidecar(
        piShareHfReviewSidecarFixture
      )
      const row = yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(piMonoTaskFirstRowFixture)
      const record = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry,
        reviewSidecar
      })
      const reviewKeyChanged = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row,
        manifestEntry,
        reviewSidecar: { ...reviewSidecar, review_key: Redacted.make("different-review-key") }
      })
      const manifest = yield* Experimental.OpenAgentTrace.makeOpenAgentTraceCorpusManifest({
        corpusId: "pi-mono-public-corpus",
        adapterId: "pi-mono",
        adapterVersion: "1",
        normalizationVersion: "1",
        projectionVersion: "workflow-v1",
        generatedAt: "2026-04-06T12:00:00.000Z",
        records: [record]
      })
      const replayManifest = yield* Experimental.OpenAgentTrace.makeOpenAgentTraceCorpusManifest({
        corpusId: "pi-mono-public-corpus",
        adapterId: "pi-mono",
        adapterVersion: "1",
        normalizationVersion: "1",
        projectionVersion: "workflow-v1",
        generatedAt: "2026-04-06T12:00:00.000Z",
        records: [reviewKeyChanged]
      })
      const signed = yield* Experimental.OpenAgentTrace.signOpenAgentTraceCorpusManifest({
        manifest,
        algorithm: "ed25519",
        secretKey: keys.secretKey,
        publicKey: keys.publicKey
      })
      const verified = yield* Experimental.OpenAgentTrace.verifyOpenAgentTraceSignedCorpusManifest(signed)
      const tampered = yield* Experimental.OpenAgentTrace.verifyOpenAgentTraceSignedCorpusManifest(
        new Experimental.OpenAgentTrace.OpenAgentTraceSignedCorpusManifest({
          ...signed,
          manifest: new Experimental.OpenAgentTrace.OpenAgentTraceCorpusManifest({
            ...manifest,
            projectionVersion: "workflow-v2"
          })
        })
      )

      expect(record.normalizedDigest).toStrictEqual(reviewKeyChanged.normalizedDigest)
      expect(record.redactedDigest).toStrictEqual(reviewKeyChanged.redactedDigest)
      expect(manifest.corpusDigest).toStrictEqual(replayManifest.corpusDigest)
      expect(verified).toBe(true)
      expect(tampered).toBe(false)
      expect(signed.manifestKind).toBe("signed-corpus-manifest")
      expect(signed.signature.algorithm).toBe("ed25519")
    }))
})
