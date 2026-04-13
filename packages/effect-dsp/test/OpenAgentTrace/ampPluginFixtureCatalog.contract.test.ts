/**
 * Contract for the checked-in Amp plugin fixture catalog.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  loadCaptureEvidence,
  loadCatalog,
  loadPluginAdapterCapture,
  loadPluginCapture
} from "../../fixtures/open-agent-trace/amp/index.js"

describe("OpenAgentTrace/ampPluginFixtureCatalog", () => {
  it.effect("loads every checked-in plugin-backed public Amp thread fixture through the package-owned loader surface", () =>
    Effect.gen(function*() {
      const entries = yield* loadCatalog()

      yield* Effect.forEach(
        entries,
        (entry) =>
          Effect.gen(function*() {
            const evidence = yield* loadCaptureEvidence("plugin", entry.threadId)
            const capture = yield* loadPluginCapture(entry.threadId)
            const adapterCapture = yield* loadPluginAdapterCapture(entry.threadId)
            const normalized = yield* Experimental.OpenAgentTrace.normalizeCapture(
              Experimental.OpenAgentTrace.Amp.pluginAdapter,
              adapterCapture
            )

            expect(entry.lanes).toEqual(["plugin", "stream-json"])
            expect(evidence.desired.threadId).toBe(entry.threadId)
            expect(evidence.desired.sourceUrl).toBe(entry.sourceUrl)
            expect(capture.threadId).toBe(entry.threadId)
            expect(adapterCapture.source.sessionId).toBe(entry.threadId)
            expect(normalized.record.source.sessionId).toBe(entry.threadId)
            expect(normalized.record.events.some((event) => event.eventKind === "bash-execution")).toBe(true)
          }),
        { concurrency: 1 }
      )
    }))
})
