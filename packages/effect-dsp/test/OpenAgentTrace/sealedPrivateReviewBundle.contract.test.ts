/**
 * Contract for sealed private-review bundles over open-agent-trace records.
 */
import { describe, expect, it } from "@effect/vitest"
import { generateKey } from "@scenesystems/seal"
import { Effect, Redacted, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../../fixtures/open-agent-trace/pi-mono/index.js"

describe("OpenAgentTrace/sealedPrivateReviewBundle", () => {
  it.effect("seals review sidecars and literal-secret policy inputs into a private envelope that round-trips without leaking into the public normalized record", () =>
    Effect.gen(function*() {
      const key = yield* generateKey()
      const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
      const reviewSidecar = yield* Experimental.OpenAgentTrace.PiMono.decodeReviewSidecar(
        piShareHfReviewSidecarFixture
      )
      const record = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row: yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture),
        manifestEntry,
        reviewSidecar
      })
      const policy = new Experimental.OpenAgentTrace.OpenAgentTraceRedactionPolicy({
        policyId: "open-agent-trace-public-corpus",
        policyVersion: 2,
        imageHandling: "keep-images",
        literalSecrets: [{
          secretId: "runtime-spine",
          secretValue: Redacted.make("server-run authority"),
          replacementToken: "[REDACTED:RUNTIME-SPINE]"
        }],
        curatedPatterns: ["openai-api-key"]
      })
      const sealed = yield* Experimental.OpenAgentTrace.sealOpenAgentTracePrivateReviewBundle({
        record,
        policy,
        key,
        keyMetadata: { keyId: "open-agent-trace-review", keyVersion: 1 },
        reviewSidecar
      })
      const roundTrip = yield* Experimental.OpenAgentTrace.unsealOpenAgentTracePrivateReviewBundle({
        bundle: sealed,
        key
      })
      const encodedSealed = yield* Schema.encode(Experimental.OpenAgentTrace.OpenAgentTraceSealedReviewBundle)(sealed)

      expect(sealed.bundleKind).toBe("sealed-review-bundle")
      expect(sealed.literalSecretCount).toBe(1)
      expect(sealed.hasReviewSidecar).toBe(true)
      expect(encodedSealed.envelope.keyId).toBe("open-agent-trace-review")
      expect(encodedSealed.envelope.ciphertext).not.toContain("review-key-public-corpus")
      expect(encodedSealed.envelope.ciphertext).not.toContain("server-run authority")
      expect(Redacted.value(roundTrip.reviewSidecar!.review_key)).toBe("review-key-public-corpus")
      expect(Redacted.value(roundTrip.literalSecrets[0]!.secretValue)).toBe("server-run authority")
      expect(record.reviewStatus.reviewKey).toBeDefined()
      expect(record.reviewStatus.projectionSafe).toBe(true)
    }))
})
