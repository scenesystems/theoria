/**
 * Contract for cross-lane Amp fixture concordance.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Order } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  loadCatalog,
  loadPluginAdapterCapture,
  loadStreamJsonAdapterCapture
} from "../../fixtures/open-agent-trace/amp/index.js"

const toolOrder = Order.string

describe("OpenAgentTrace/ampFixtureConcordance", () => {
  it.effect("proves the Plugin API and stream-json fixtures agree on shared thread facts for every checked-in public Amp thread without requiring identical normalized records", () =>
    Effect.gen(function*() {
      const entries = yield* loadCatalog()

      yield* Effect.forEach(
        entries,
        (entry) =>
          Effect.gen(function*() {
            const pluginCapture = yield* loadPluginAdapterCapture(entry.threadId)
            const streamCapture = yield* loadStreamJsonAdapterCapture(entry.threadId)
            const plugin = yield* Experimental.OpenAgentTrace.normalizeCapture(
              Experimental.OpenAgentTrace.Amp.pluginAdapter,
              pluginCapture
            )
            const stream = yield* Experimental.OpenAgentTrace.normalizeCapture(
              Experimental.OpenAgentTrace.Amp.streamJsonAdapter,
              streamCapture
            )
            const pluginTask = Experimental.OpenAgentTrace.projectCodingTask(plugin.record)
            const streamTask = Experimental.OpenAgentTrace.projectCodingTask(stream.record)
            const pluginEvidence = Experimental.OpenAgentTrace.projectCodingEvidence(plugin.record)
            const streamEvidence = Experimental.OpenAgentTrace.projectCodingEvidence(stream.record)
            const pluginCommands = plugin.record.events.flatMap((event) =>
              event.eventKind === "bash-execution" && event.command ? [event.command] : []
            )
            const streamCommands = stream.record.events.flatMap((event) =>
              event.eventKind === "bash-execution" && event.command ? [event.command] : []
            )
            const pluginCoverageKinds = plugin.coverageGaps.map((gap) => gap.sourceKind)
            const streamCoverageKinds = stream.coverageGaps.map((gap) => gap.sourceKind)

            expect(entry.lanes).toEqual(["plugin", "stream-json"])
            expect(plugin.record.source.sessionId).toBe(entry.threadId)
            expect(stream.record.source.sessionId).toBe(entry.threadId)
            expect(pluginTask.summary).toBe(entry.shared.firstTaskSummary)
            expect(streamTask.summary).toBe(entry.shared.firstTaskSummary)
            expect(Arr.sort(pluginEvidence.toolNames, toolOrder)).toEqual(entry.plugin.toolNames)
            expect(Arr.sort(streamEvidence.toolNames, toolOrder)).toEqual(entry.plugin.toolNames)
            expect(pluginCommands).toEqual(entry.shared.shellCommands)
            expect(streamCommands).toEqual(entry.shared.shellCommands)
            expect(Arr.sort(pluginCoverageKinds, toolOrder)).toEqual(Arr.sort(entry.plugin.coverageKinds, toolOrder))
            expect(streamCoverageKinds).toEqual(entry.streamJson.coverageKinds)
            expect(streamCoverageKinds.every((kind) => pluginCoverageKinds.includes(kind))).toBe(true)
          }),
        { concurrency: 1 }
      )
    }))
})
