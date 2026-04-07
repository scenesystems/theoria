/**
 * Contract for deterministic normalized-trace redaction.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Redacted, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/redactionPolicy", () => {
  it.effect("replaces literal secrets and curated credential patterns deterministically and forces manual review when heuristic credentials were found", () =>
    Effect.gen(function*() {
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
      const encoded = yield* Schema.encode(Experimental.OpenAgentTrace.OpenAgentTraceRecord)(record)
      const seeded = yield* Schema.decodeUnknown(Experimental.OpenAgentTrace.OpenAgentTraceRecord)({
        ...encoded,
        events: encoded.events.map((event) =>
          event.eventKind === "message" && event.eventId === "0000000e"
            ? {
              ...event,
              contentBlocks: event.contentBlocks.map((block) =>
                block.type === "text"
                  ? {
                    ...block,
                    text:
                      `${block.text} Credential openai-api-key:abcdefghijklmnop keeps the server-run authority stable.`
                  }
                  : block
              )
            }
            : event
        )
      })
      const policy = new Experimental.OpenAgentTrace.OpenAgentTraceRedactionPolicy({
        policyId: "open-agent-trace-public-corpus",
        policyVersion: 1,
        imageHandling: "keep-images",
        literalSecrets: [{
          secretId: "surviving-fix-path",
          secretValue: Redacted.make("server-run authority"),
          replacementToken: "[REDACTED:SURVIVING-FIX-PATH]"
        }],
        curatedPatterns: ["openai-api-key"]
      })
      const redacted = yield* Experimental.OpenAgentTrace.redactOpenAgentTraceRecord({
        record: seeded,
        policy,
        reviewSidecar
      })
      const replay = yield* Experimental.OpenAgentTrace.redactOpenAgentTraceRecord({
        record: seeded,
        policy,
        reviewSidecar
      })
      const targetEvent = redacted.events.find((event) => event.eventKind === "message" && event.eventId === "0000000e")
      const targetBlock = targetEvent?.eventKind === "message"
        ? targetEvent.contentBlocks.find((block) => block.type === "text")
        : undefined

      expect(replay).toStrictEqual(redacted)
      expect(targetBlock?.type).toBe("text")
      expect(targetBlock?.type === "text" ? targetBlock.text : undefined).toContain("[REDACTED:SURVIVING-FIX-PATH]")
      expect(targetBlock?.type === "text" ? targetBlock.text : undefined).toContain("[REDACTED:OPENAI-API-KEY]")
      expect(targetBlock?.type === "text" ? targetBlock.text : undefined).not.toContain("server-run authority")
      expect(redacted.redactionFindings.some((finding) => finding.findingKind === "literal-secret")).toBe(true)
      expect(redacted.redactionFindings.some((finding) => finding.findingKind === "credential-pattern")).toBe(true)
      expect(redacted.reviewStatus.manualReviewRequired).toBe(true)
      expect(redacted.reviewStatus.projectionSafe).toBe(false)
    }))
})
