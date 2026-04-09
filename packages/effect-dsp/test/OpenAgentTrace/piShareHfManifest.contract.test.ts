/**
 * Contract for `pi-share-hf` manifest decoding and published integrity semantics.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piShareHfManifestFixture } from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/piShareHfManifest", () => {
  it.effect("decodes file, source_hash, redaction_key, and redacted_hash and treats redacted_hash as the published integrity identity", () =>
    Effect.gen(function*() {
      const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
      const manifestDocument = yield* Schema.encode(
        Schema.parseJson(Experimental.OpenAgentTrace.PiShareHfManifestEntry)
      )(manifestEntry)
      const manifestEntries = yield* Experimental.OpenAgentTrace.decodePiShareHfManifestDocument(manifestDocument)

      expect(manifestEntry.file).toBe(piShareHfManifestFixture.file)
      expect(manifestEntry.source_hash).toBe(piShareHfManifestFixture.source_hash)
      expect(manifestEntry.redaction_key).toBe(piShareHfManifestFixture.redaction_key)
      expect(manifestEntry.redacted_hash).toBe(piShareHfManifestFixture.redacted_hash)
      expect(manifestEntries).toEqual([manifestEntry])
      expect(
        Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(
          yield* Experimental.OpenAgentTrace.PiMono.publishedIntegrityDigest(manifestEntry)
        )
      ).toBe(
        piShareHfManifestFixture.redacted_hash
      )
      expect(piShareHfManifestFixture.redacted_hash).not.toBe(
        piShareHfManifestFixture.source_hash
      )
    }))
})
