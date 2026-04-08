import { HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option, Schema } from "effect"

import {
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryEnvelope
} from "../../app/contracts/open-agent-trace.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { openAgentTraceRoute } from "../../app/server/routes/open-agent-trace.js"
import { openAgentTracePanelModel } from "../../app/web/view/open-agent-trace/model.js"

class ResponseJsonError extends Schema.TaggedError<ResponseJsonError>()("ResponseJsonError", {
  message: Schema.String
}) {}

type OpenAgentTraceEvent = OpenAgentTraceRegistryEntry["record"]["events"][number]
type OpenAgentTraceMessageEvent = Extract<OpenAgentTraceEvent, { readonly eventKind: "message" }>
type OpenAgentTraceContentBlock = OpenAgentTraceMessageEvent["contentBlocks"][number]

const blockText = (block: OpenAgentTraceContentBlock): string =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }) => text),
    Match.when({ type: "thinking" }, ({ thinking }) => thinking),
    Match.when({ type: "image" }, ({ mimeType }) => `[image:${mimeType}]`),
    Match.when({ type: "toolCall" }, ({ toolName }) => `${toolName}`),
    Match.when({ type: "json" }, () => "[json block]"),
    Match.exhaustive
  )

const firstTraceDetailExpectation = (entry: OpenAgentTraceRegistryEntry): string => {
  return Option.match(Option.fromNullable(entry.record.events[0]), {
    onNone: () => "",
    onSome: (firstEvent) =>
      Match.value(firstEvent).pipe(
        Match.when({ eventKind: "message" }, (event) => event.contentBlocks.map(blockText).join(" ")),
        Match.when({ eventKind: "compaction" }, (event) => event.summaryText),
        Match.when({ eventKind: "branch-summary" }, (event) => event.summaryText),
        Match.when({ eventKind: "custom-message" }, (event) => (event.contentBlocks ?? []).map(blockText).join(" ")),
        Match.orElse((event) => event.eventKind)
      )
  })
}

const decodeWebJson = <A, I>(
  response: HttpServerResponse.HttpServerResponse,
  schema: Schema.Schema<A, I>
) =>
  Effect.gen(function*() {
    const webResponse = HttpServerResponse.toWeb(response)
    const body = yield* Effect.tryPromise({
      try: () => webResponse.json(),
      catch: (cause) => new ResponseJsonError({ message: String(cause) })
    }).pipe(Effect.orDie)

    return yield* Schema.decodeUnknown(schema)(body).pipe(Effect.orDie)
  })

describe("web/open-agent-trace-orchestration", () => {
  it.effect("projects actual trace narrative, workflow cases, and usage provenance for the shared effect-dsp consumer lane", () =>
    Effect.gen(function*() {
      const response = yield* openAgentTraceRoute("/api/open-agent-trace/registry", "req-open-agent-trace-web").pipe(
        Effect.provide(RuntimeInfoLive)
      )
      const envelope = yield* decodeWebJson(response, OpenAgentTraceRegistryEnvelope)

      expect(envelope.ok).toBe(true)

      if (!envelope.ok) {
        return
      }

      const model = openAgentTracePanelModel(envelope.data)
      const taskFirst = model.entries[0]
      const chatContinuation = model.entries[1]
      const taskFirstEntry = envelope.data[0]
      const chatContinuationEntry = envelope.data[1]

      expect(model.summaryRows.map((row) => row.label)).toEqual([
        "Records",
        "Coverage Gaps",
        "Experimental Surface"
      ])
      expect(taskFirst?.sourceRows.find((row) => row.label === "Dataset")?.value).toBe(
        taskFirstEntry?.record.source.datasetId
      )
      expect(taskFirst?.branchItems[0]?.label).toBe(taskFirstEntry?.record.branches[0]?.branchId)
      expect(taskFirst?.traceEventItems[0]?.detail).toContain(firstTraceDetailExpectation(taskFirstEntry!))
      expect(taskFirst?.traceEventItems[1]?.detail).toContain("I'll inspect the runtime state machine first")
      expect(taskFirst?.workflowRows.find((row) => row.label === "Workflow Kind")?.value).toBe(
        taskFirstEntry?.workflowProjection.workflowRecord.workflowKind
      )
      expect(taskFirst?.graphNodeItems[0]?.label).toBe(
        taskFirstEntry?.workflowProjection.workflowRecord.graph.nodes[0]?.nodeId
      )
      expect(taskFirst?.workflowCaseItems[0]?.detail).toContain(
        taskFirstEntry?.workflowProjection.workflowRecord.evaluation.cases[0]?.prompt ?? ""
      )
      expect(taskFirst?.usageItems[0]?.label).toContain(
        taskFirstEntry?.workflowProjection.usageProvenance[0]?.model ?? ""
      )
      expect(taskFirst?.coverageItems.map((item) => item.label)).toEqual(
        taskFirstEntry?.workflowProjection.coverageGaps.map((gap) => `${gap.sourceKind} · ${gap.gapId}`)
      )
      expect(chatContinuation?.coverageItems).toEqual([])
      expect(chatContinuation?.graphNodeItems[0]?.label).toBe(
        chatContinuationEntry?.workflowProjection.workflowRecord.graph.nodes[0]?.nodeId
      )
      expect(chatContinuation?.traceEventItems[0]?.detail).toContain(
        firstTraceDetailExpectation(chatContinuationEntry!)
      )
    }))
})
