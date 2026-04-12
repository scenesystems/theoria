import { HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option, Schema } from "effect"

import {
  type OpenAgentTraceEntryPanelModel,
  OpenAgentTracePanelData,
  type OpenAgentTracePanelGroupKey,
  OpenAgentTracePanelModel,
  type OpenAgentTracePanelSectionKey,
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryEnvelope
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { openAgentTraceRoute } from "../../app/server/routes/open-agent-trace.js"

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

const panelEntriesFor = (
  model: OpenAgentTracePanelModel
): ReadonlyArray<OpenAgentTraceEntryPanelModel> => model.entries

const sectionFor = ({
  entry,
  groupKey,
  sectionKey
}: {
  readonly entry: Option.Option<OpenAgentTraceEntryPanelModel>
  readonly groupKey: OpenAgentTracePanelGroupKey
  readonly sectionKey: OpenAgentTracePanelSectionKey
}) =>
  entry.pipe(
    Option.flatMap((resolvedEntry) =>
      Option.fromNullable(resolvedEntry.groups.find((group) => group.key === groupKey)).pipe(
        Option.flatMap((group) => Option.fromNullable(group.sections.find((section) => section.key === sectionKey)))
      )
    )
  )

const summaryRowsFor = ({
  entry,
  groupKey,
  sectionKey
}: {
  readonly entry: Option.Option<OpenAgentTraceEntryPanelModel>
  readonly groupKey: OpenAgentTracePanelGroupKey
  readonly sectionKey: OpenAgentTracePanelSectionKey
}) =>
  sectionFor({ entry, groupKey, sectionKey }).pipe(
    Option.match({
      onNone: () => [],
      onSome: (section) =>
        Match.value(section).pipe(
          Match.tag("OpenAgentTraceSummaryPanelSection", ({ rows }) => rows),
          Match.tag("OpenAgentTraceDetailsPanelSection", () => []),
          Match.tag("OpenAgentTraceCoveragePanelSection", () => []),
          Match.exhaustive
        )
    })
  )

const detailItemsFor = ({
  entry,
  groupKey,
  sectionKey
}: {
  readonly entry: Option.Option<OpenAgentTraceEntryPanelModel>
  readonly groupKey: OpenAgentTracePanelGroupKey
  readonly sectionKey: OpenAgentTracePanelSectionKey
}) =>
  sectionFor({ entry, groupKey, sectionKey }).pipe(
    Option.match({
      onNone: () => [],
      onSome: (section) =>
        Match.value(section).pipe(
          Match.tag("OpenAgentTraceSummaryPanelSection", () => []),
          Match.tag("OpenAgentTraceDetailsPanelSection", ({ items }) => items),
          Match.tag("OpenAgentTraceCoveragePanelSection", ({ items }) => items),
          Match.exhaustive
        )
    })
  )

describe("web/open-agent-trace-orchestration", () => {
  it.effect("projects actual trace narrative, workflow cases, and usage provenance for the shared effect-dsp study lane", () =>
    Effect.gen(function*() {
      const response = yield* openAgentTraceRoute("/api/open-agent-trace/registry", "req-open-agent-trace-web").pipe(
        Effect.provide(RuntimeInfoLive)
      )
      const envelope = yield* decodeWebJson(response, OpenAgentTraceRegistryEnvelope)

      expect(envelope.ok).toBe(true)

      if (!envelope.ok) {
        return
      }

      const model = OpenAgentTracePanelModel.project(
        OpenAgentTracePanelData.assemble({
          consumerArtifacts: [],
          registry: envelope.data,
          workflowHookups: []
        })
      )
      const entries = panelEntriesFor(model)
      const taskFirst = Option.fromNullable(entries[0])
      const chatContinuation = Option.fromNullable(entries[1])
      const taskFirstEntry = envelope.data[0]
      const chatContinuationEntry = envelope.data[1]

      expect(model.entries.length).toBe(envelope.data.length)
      expect(model.summaryRows.map((row: OpenAgentTracePanelModel["summaryRows"][number]) => row.label)).toEqual([
        "Records",
        "Coverage Gaps",
        "Consumer Artifacts",
        "Corpus Lane",
        "Workflow Hookups"
      ])
      expect(
        summaryRowsFor({ entry: taskFirst, groupKey: "source", sectionKey: "corpus-source" }).find(
          (row) => row.label === "Dataset"
        )?.value
      ).toBe(
        taskFirstEntry?.record.source.datasetId
      )
      expect(detailItemsFor({ entry: taskFirst, groupKey: "trace", sectionKey: "branch-tree" })[0]?.label).toBe(
        taskFirstEntry?.record.branches[0]?.branchId
      )
      expect(detailItemsFor({ entry: taskFirst, groupKey: "trace", sectionKey: "active-trace" })[0]?.detail).toContain(
        firstTraceDetailExpectation(taskFirstEntry!)
      )
      expect(detailItemsFor({ entry: taskFirst, groupKey: "trace", sectionKey: "active-trace" })[1]?.detail).toContain(
        "I'll inspect the runtime state machine first"
      )
      expect(
        summaryRowsFor({ entry: taskFirst, groupKey: "workflow", sectionKey: "projected-workflow" }).find(
          (row) => row.label === "Workflow Kind"
        )?.value
      ).toBe(
        taskFirstEntry?.workflowProjection.workflowRecord.workflowKind
      )
      expect(detailItemsFor({ entry: taskFirst, groupKey: "workflow", sectionKey: "workflow-nodes" })[0]?.label).toBe(
        taskFirstEntry?.workflowProjection.workflowRecord.graph.nodes[0]?.nodeId
      )
      expect(detailItemsFor({ entry: taskFirst, groupKey: "usage", sectionKey: "evaluation-cases" })[0]?.detail)
        .toContain(
          taskFirstEntry?.workflowProjection.workflowRecord.evaluation.cases[0]?.prompt ?? ""
        )
      expect(detailItemsFor({ entry: taskFirst, groupKey: "usage", sectionKey: "usage-provenance" })[0]?.label)
        .toContain(
          taskFirstEntry?.workflowProjection.usageProvenance[0]?.model ?? ""
        )
      expect(
        detailItemsFor({ entry: taskFirst, groupKey: "coverage", sectionKey: "coverage-gaps" }).map(
          (item) => item.label
        )
      ).toEqual(
        taskFirstEntry?.workflowProjection.coverageGaps.map((gap) => `${gap.sourceKind} · ${gap.gapId}`)
      )
      expect(detailItemsFor({ entry: chatContinuation, groupKey: "coverage", sectionKey: "coverage-gaps" })).toEqual([])
      expect(detailItemsFor({ entry: chatContinuation, groupKey: "workflow", sectionKey: "workflow-nodes" })[0]?.label)
        .toBe(
          chatContinuationEntry?.workflowProjection.workflowRecord.graph.nodes[0]?.nodeId
        )
      expect(detailItemsFor({ entry: chatContinuation, groupKey: "trace", sectionKey: "active-trace" })[0]?.detail)
        .toContain(
          firstTraceDetailExpectation(chatContinuationEntry!)
        )
    }))
})
