/**
 * Contract for real-thread Amp fixture provenance.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Order } from "effect"

import {
  loadCaptureEvidence,
  loadCatalog,
  loadPluginCapture,
  loadStreamJsonCapture
} from "../../fixtures/open-agent-trace/amp/index.js"

const toolOrder = Order.string

describe("OpenAgentTrace/ampFixtureProvenance", () => {
  it.effect("proves every checked-in Amp fixture thread keeps real raw-artifact provenance across the plugin and stream-json lanes", () =>
    Effect.gen(function*() {
      const entries = yield* loadCatalog()

      yield* Effect.forEach(
        entries,
        (entry) =>
          Effect.gen(function*() {
            const pluginEvidence = yield* loadCaptureEvidence("plugin", entry.threadId)
            const streamEvidence = yield* loadCaptureEvidence("stream-json", entry.threadId)
            const pluginCapture = yield* loadPluginCapture(entry.threadId)
            const streamCapture = yield* loadStreamJsonCapture(entry.threadId)

            expect(entry.lanes).toEqual(["plugin", "stream-json"])
            expect(pluginEvidence.desired.threadId).toBe(entry.threadId)
            expect(streamEvidence.desired.threadId).toBe(entry.threadId)
            expect(pluginEvidence.desired.sourceUrl).toBe(entry.sourceUrl)
            expect(streamEvidence.desired.sourceUrl).toBe(entry.sourceUrl)
            expect(pluginEvidence.desired.captureMethod).toBe(entry.plugin.captureMethod)
            expect(streamEvidence.desired.captureMethod).toBe(entry.streamJson.captureMethod)
            expect(pluginEvidence.resolved.threadId).toBe(entry.threadId)
            expect(streamEvidence.resolved.threadId).toBe(entry.threadId)
            expect(pluginEvidence.resolved.sessionId).toBe(entry.threadId)
            expect(streamEvidence.resolved.sessionId).toBe(entry.threadId)
            expect(pluginEvidence.resolved.rawFileName).toBe(entry.plugin.rawFileName)
            expect(streamEvidence.resolved.rawFileName).toBe(entry.streamJson.rawFileName)
            expect(pluginEvidence.resolved.derivedFileName).toBe(entry.plugin.derivedFileName)
            expect(streamEvidence.resolved.derivedFileName).toBe(entry.streamJson.derivedFileName)
            expect(pluginEvidence.observed.firstTaskSummary).toBe(entry.shared.firstTaskSummary)
            expect(streamEvidence.observed.firstTaskSummary).toBe(entry.shared.firstTaskSummary)
            expect(Arr.sort(pluginEvidence.observed.toolNames, toolOrder)).toEqual(entry.plugin.toolNames)
            expect(Arr.sort(streamEvidence.observed.toolNames, toolOrder)).toEqual(entry.streamJson.toolNames)
            expect(pluginEvidence.observed.shellCommands).toEqual(entry.shared.shellCommands)
            expect(streamEvidence.observed.shellCommands).toEqual(entry.shared.shellCommands)
            expect(pluginEvidence.observed.terminalStatus).toBe(entry.plugin.terminalStatus)
            expect(streamEvidence.observed.terminalStatus).toBe(entry.streamJson.terminalStatus)
            expect(pluginEvidence.observed.coverageKinds).toEqual(entry.plugin.coverageKinds)
            expect(streamEvidence.observed.coverageKinds).toEqual(entry.streamJson.coverageKinds)
            expect(pluginEvidence.reviewBoundary.rawArtifactAuthority).toBe(entry.plugin.rawArtifactAuthority)
            expect(streamEvidence.reviewBoundary.rawArtifactAuthority).toBe(entry.streamJson.rawArtifactAuthority)
            expect(pluginEvidence.reviewBoundary.derivedReplayAuthority).toBe(entry.plugin.derivedReplayAuthority)
            expect(streamEvidence.reviewBoundary.derivedReplayAuthority).toBe(entry.streamJson.derivedReplayAuthority)
            expect(pluginCapture.threadId).toBe(entry.threadId)
            expect(streamCapture.lines[0]?.session_id).toBe(entry.threadId)
          }),
        { concurrency: 1 }
      )
    }))
})
