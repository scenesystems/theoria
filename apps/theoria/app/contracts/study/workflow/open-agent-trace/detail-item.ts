import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { OpenAgentTraceRecord, OpenAgentTraceRegistryEntry } from "./study-material.js"

type CoverageWorkflowRecord = OpenAgentTraceRegistryEntry["workflowProjection"]["workflowRecord"]
type OpenAgentTraceEvent = OpenAgentTraceRecord["events"][number]
type OpenAgentTraceMessageEvent = Extract<OpenAgentTraceEvent, { readonly eventKind: "message" }>
type OpenAgentTraceSummaryEvent = Extract<
  OpenAgentTraceEvent,
  { readonly eventKind: "compaction" | "branch-summary" }
>
type OpenAgentTraceRuntimeEvent = Extract<
  OpenAgentTraceEvent,
  { readonly eventKind: "model-change" | "thinking-level-change" | "bash-execution" }
>
type OpenAgentTraceMetadataEvent = Extract<
  OpenAgentTraceEvent,
  { readonly eventKind: "custom" | "custom-message" | "label" | "session-info" }
>
type OpenAgentTraceContentBlock = OpenAgentTraceMessageEvent["contentBlocks"][number]
type WorkflowNode = CoverageWorkflowRecord["graph"]["nodes"][number]
type WorkflowEdge = CoverageWorkflowRecord["graph"]["edges"][number]
type WorkflowEvaluationCase = CoverageWorkflowRecord["evaluation"]["cases"][number]
type UsageProvenance = OpenAgentTraceRegistryEntry["workflowProjection"]["usageProvenance"][number]

const compact = (text: string, max = 140): string => text.length > max ? `${text.slice(0, max).trimEnd()}…` : text

const joinParts = (parts: ReadonlyArray<string>): string =>
  Arr.join(Arr.filter(parts, (part) => part.trim().length > 0), " · ")

const blockText = (block: OpenAgentTraceContentBlock): string =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }) => text),
    Match.when({ type: "thinking" }, ({ thinking }) => `[thinking] ${thinking}`),
    Match.when({ type: "image" }, ({ mimeType }) => `[image:${mimeType}]`),
    Match.when({ type: "toolCall" }, ({ toolName }) => `[tool:${toolName}]`),
    Match.when({ type: "json" }, () => "[json block]"),
    Match.exhaustive
  )

export class OpenAgentTraceDetailItem extends Schema.Class<OpenAgentTraceDetailItem>("OpenAgentTraceDetailItem")({
  detail: Schema.String,
  label: Schema.String
}) {
  private static optionalPart(value: unknown, prefix?: string): ReadonlyArray<string> {
    return Option.match(Option.fromNullable(value), {
      onNone: () => [],
      onSome: (resolvedValue) =>
        Option.match(Option.fromNullable(prefix), {
          onNone: () => [String(resolvedValue)],
          onSome: (resolvedPrefix) => [`${resolvedPrefix} ${String(resolvedValue)}`]
        })
    })
  }

  private static metadataDetail(event: OpenAgentTraceMetadataEvent): string {
    return compact(
      joinParts([
        ...OpenAgentTraceDetailItem.optionalPart(event.label),
        ...OpenAgentTraceDetailItem.optionalPart(event.sessionName),
        ...Option.match(Option.fromNullable(event.contentBlocks), {
          onNone: () => [],
          onSome: (contentBlocks) => [joinParts(contentBlocks.map(blockText))]
        })
      ])
    )
  }

  private static runtimeDetail(event: OpenAgentTraceRuntimeEvent): string {
    return compact(
      joinParts([
        ...OpenAgentTraceDetailItem.optionalPart(event.modelId),
        ...OpenAgentTraceDetailItem.optionalPart(event.thinkingLevel),
        ...OpenAgentTraceDetailItem.optionalPart(event.command),
        ...OpenAgentTraceDetailItem.optionalPart(event.outputText)
      ])
    )
  }

  static branches(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceDetailItem> {
    return entry.record.branches.map((branch) =>
      OpenAgentTraceDetailItem.make({
        label: branch.branchId,
        detail: joinParts([
          `leaf ${branch.leafEntryId}`,
          ...OpenAgentTraceDetailItem.optionalPart(branch.parentBranchId, "parent"),
          ...OpenAgentTraceDetailItem.optionalPart(branch.fromEntryId, "from"),
          ...OpenAgentTraceDetailItem.optionalPart(branch.branchSummaryText)
        ])
      })
    )
  }

  static events(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceDetailItem> {
    return entry.record.events.map((event) =>
      Match.value(event).pipe(
        Match.when({ eventKind: "message" }, (value: OpenAgentTraceMessageEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.actor.role} · ${value.eventId}`,
            detail: compact(
              joinParts([
                joinParts(value.contentBlocks.map(blockText)),
                ...OpenAgentTraceDetailItem.optionalPart(value.piTurnProvenance?.model, "model"),
                ...OpenAgentTraceDetailItem.optionalPart(value.errorMessage, "error")
              ])
            )
          })),
        Match.when({ eventKind: "compaction" }, (value: OpenAgentTraceSummaryEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: Match.value(value).pipe(
              Match.when({ eventKind: "compaction" }, ({ firstKeptEntryId, summaryText }) =>
                compact(
                  joinParts([
                    summaryText,
                    ...OpenAgentTraceDetailItem.optionalPart(firstKeptEntryId, "kept from")
                  ])
                )),
              Match.when({ eventKind: "branch-summary" }, ({ summaryText }) => compact(summaryText)),
              Match.exhaustive
            )
          })),
        Match.when({ eventKind: "branch-summary" }, (value: OpenAgentTraceSummaryEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: compact(value.summaryText)
          })),
        Match.when({ eventKind: "model-change" }, (value: OpenAgentTraceRuntimeEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: OpenAgentTraceDetailItem.runtimeDetail(value)
          })),
        Match.when({ eventKind: "thinking-level-change" }, (value: OpenAgentTraceRuntimeEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: OpenAgentTraceDetailItem.runtimeDetail(value)
          })),
        Match.when({ eventKind: "bash-execution" }, (value: OpenAgentTraceRuntimeEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: OpenAgentTraceDetailItem.runtimeDetail(value)
          })),
        Match.when({ eventKind: "custom" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: OpenAgentTraceDetailItem.metadataDetail(value)
          })),
        Match.when({ eventKind: "custom-message" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: OpenAgentTraceDetailItem.metadataDetail(value)
          })),
        Match.when({ eventKind: "label" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: OpenAgentTraceDetailItem.metadataDetail(value)
          })),
        Match.when({ eventKind: "session-info" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: OpenAgentTraceDetailItem.metadataDetail(value)
          })),
        Match.exhaustive
      )
    )
  }

  static usage(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceDetailItem> {
    return entry.workflowProjection.usageProvenance.map((usage: UsageProvenance) =>
      OpenAgentTraceDetailItem.make({
        label: `${usage.eventId} · ${
          Option.match(Option.fromNullable(usage.model), {
            onNone: () => "n/a",
            onSome: (model) => String(model)
          })
        }`,
        detail: joinParts([
          ...OpenAgentTraceDetailItem.optionalPart(usage.provider),
          ...OpenAgentTraceDetailItem.optionalPart(usage.api),
          ...OpenAgentTraceDetailItem.optionalPart(usage.usage.inputTokens, "input"),
          ...OpenAgentTraceDetailItem.optionalPart(usage.usage.outputTokens, "output"),
          ...OpenAgentTraceDetailItem.optionalPart(usage.cacheReadTokens, "cache read"),
          ...OpenAgentTraceDetailItem.optionalPart(usage.totalTokens, "total"),
          ...OpenAgentTraceDetailItem.optionalPart(usage.costUsd, "cost")
        ])
      })
    )
  }

  static workflowCases(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceDetailItem> {
    return entry.workflowProjection.workflowRecord.evaluation.cases.map((evaluationCase: WorkflowEvaluationCase) =>
      OpenAgentTraceDetailItem.make({
        label: evaluationCase.caseId,
        detail: compact(
          joinParts([
            evaluationCase.prompt,
            `signals ${Arr.join(evaluationCase.expectedSignals, ", ")}`,
            evaluationCase.renderCritical ? "render critical" : "render supportive"
          ]),
          220
        )
      })
    )
  }

  static workflowEdges(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceDetailItem> {
    return entry.workflowProjection.workflowRecord.graph.edges.map((edge: WorkflowEdge) =>
      OpenAgentTraceDetailItem.make({
        label: edge.edgeId,
        detail: `${edge.fromNodeId} -> ${edge.toNodeId} · ${edge.kind}`
      })
    )
  }

  static workflowNodes(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceDetailItem> {
    return entry.workflowProjection.workflowRecord.graph.nodes.map((node: WorkflowNode) =>
      OpenAgentTraceDetailItem.make({
        label: node.nodeId,
        detail: joinParts([
          node.runtimeRole,
          `${Arr.join(node.inputLanes, ", ")} -> ${node.outputLane}`,
          node.loopPolicy,
          node.optimizationKnobRefs.length === 0
            ? "no released knobs"
            : `knobs: ${Arr.join(node.optimizationKnobRefs, ", ")}`
        ])
      })
    )
  }
}
