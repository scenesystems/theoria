import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type {
  OpenAgentTraceRecord,
  OpenAgentTraceRegistryEntry
} from "../../../contracts/study/workflow/open-agent-trace.js"

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
type OpenAgentTraceTextBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "text" }>
type OpenAgentTraceThinkingBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "thinking" }>
type OpenAgentTraceImageBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "image" }>
type OpenAgentTraceToolCallBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "toolCall" }>
type OpenAgentTraceJsonBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "json" }>
type WorkflowNode = CoverageWorkflowRecord["graph"]["nodes"][number]
type WorkflowEdge = CoverageWorkflowRecord["graph"]["edges"][number]
type WorkflowEvaluationCase = CoverageWorkflowRecord["evaluation"]["cases"][number]
type UsageProvenance = OpenAgentTraceRegistryEntry["workflowProjection"]["usageProvenance"][number]

const compact = (text: string, max = 140): string => text.length > max ? `${text.slice(0, max).trimEnd()}…` : text

const joinParts = (parts: ReadonlyArray<string>): string =>
  Arr.join(Arr.filter(parts, (part) => part.trim().length > 0), " · ")

const blockText = (block: OpenAgentTraceContentBlock): string =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }: OpenAgentTraceTextBlock) => text),
    Match.when({ type: "thinking" }, ({ thinking }: OpenAgentTraceThinkingBlock) => `[thinking] ${thinking}`),
    Match.when({ type: "image" }, ({ mimeType }: OpenAgentTraceImageBlock) => `[image:${mimeType}]`),
    Match.when({ type: "toolCall" }, ({ toolName }: OpenAgentTraceToolCallBlock) => `[tool:${toolName}]`),
    Match.when({ type: "json" }, (_: OpenAgentTraceJsonBlock) => "[json block]"),
    Match.exhaustive
  )

export class OpenAgentTraceDetailItem extends Schema.Class<OpenAgentTraceDetailItem>("OpenAgentTraceDetailItem")({
  detail: Schema.String,
  label: Schema.String
}) {
  static branches(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceDetailItem> {
    return entry.record.branches.map((branch) =>
      OpenAgentTraceDetailItem.make({
        label: branch.branchId,
        detail: joinParts([
          `leaf ${branch.leafEntryId}`,
          ...Option.match(Option.fromNullable(branch.parentBranchId), {
            onNone: () => [],
            onSome: (parentBranchId) => [`parent ${parentBranchId}`]
          }),
          ...Option.match(Option.fromNullable(branch.fromEntryId), {
            onNone: () => [],
            onSome: (fromEntryId) => [`from ${fromEntryId}`]
          }),
          ...Option.match(Option.fromNullable(branch.branchSummaryText), {
            onNone: () => [],
            onSome: (summaryText) => [summaryText]
          })
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
                ...Option.match(Option.fromNullable(value.piTurnProvenance?.model), {
                  onNone: () => [],
                  onSome: (model) => [`model ${model}`]
                }),
                ...Option.match(Option.fromNullable(value.errorMessage), {
                  onNone: () => [],
                  onSome: (errorMessage) => [`error ${errorMessage}`]
                })
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
                    ...Option.match(Option.fromNullable(firstKeptEntryId), {
                      onNone: () => [],
                      onSome: (entryId) => [`kept from ${entryId}`]
                    })
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
            detail: compact(
              joinParts([
                ...Option.match(Option.fromNullable(value.modelId), {
                  onNone: () => [],
                  onSome: (modelId) => [String(modelId)]
                }),
                ...Option.match(Option.fromNullable(value.thinkingLevel), {
                  onNone: () => [],
                  onSome: (thinkingLevel) => [String(thinkingLevel)]
                }),
                ...Option.match(Option.fromNullable(value.command), {
                  onNone: () => [],
                  onSome: (command) => [String(command)]
                }),
                ...Option.match(Option.fromNullable(value.outputText), {
                  onNone: () => [],
                  onSome: (outputText) => [String(outputText)]
                })
              ])
            )
          })),
        Match.when({ eventKind: "thinking-level-change" }, (value: OpenAgentTraceRuntimeEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: compact(
              joinParts([
                ...Option.match(Option.fromNullable(value.modelId), {
                  onNone: () => [],
                  onSome: (modelId) => [String(modelId)]
                }),
                ...Option.match(Option.fromNullable(value.thinkingLevel), {
                  onNone: () => [],
                  onSome: (thinkingLevel) => [String(thinkingLevel)]
                }),
                ...Option.match(Option.fromNullable(value.command), {
                  onNone: () => [],
                  onSome: (command) => [String(command)]
                }),
                ...Option.match(Option.fromNullable(value.outputText), {
                  onNone: () => [],
                  onSome: (outputText) => [String(outputText)]
                })
              ])
            )
          })),
        Match.when({ eventKind: "bash-execution" }, (value: OpenAgentTraceRuntimeEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: compact(
              joinParts([
                ...Option.match(Option.fromNullable(value.modelId), {
                  onNone: () => [],
                  onSome: (modelId) => [String(modelId)]
                }),
                ...Option.match(Option.fromNullable(value.thinkingLevel), {
                  onNone: () => [],
                  onSome: (thinkingLevel) => [String(thinkingLevel)]
                }),
                ...Option.match(Option.fromNullable(value.command), {
                  onNone: () => [],
                  onSome: (command) => [String(command)]
                }),
                ...Option.match(Option.fromNullable(value.outputText), {
                  onNone: () => [],
                  onSome: (outputText) => [String(outputText)]
                })
              ])
            )
          })),
        Match.when({ eventKind: "custom" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: compact(
              joinParts([
                ...Option.match(Option.fromNullable(value.label), {
                  onNone: () => [],
                  onSome: (label) => [label]
                }),
                ...Option.match(Option.fromNullable(value.sessionName), {
                  onNone: () => [],
                  onSome: (sessionName) => [sessionName]
                }),
                ...Option.match(Option.fromNullable(value.contentBlocks), {
                  onNone: () => [],
                  onSome: (contentBlocks) => [joinParts(contentBlocks.map(blockText))]
                })
              ])
            )
          })),
        Match.when({ eventKind: "custom-message" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: compact(
              joinParts([
                ...Option.match(Option.fromNullable(value.label), {
                  onNone: () => [],
                  onSome: (label) => [label]
                }),
                ...Option.match(Option.fromNullable(value.sessionName), {
                  onNone: () => [],
                  onSome: (sessionName) => [sessionName]
                }),
                ...Option.match(Option.fromNullable(value.contentBlocks), {
                  onNone: () => [],
                  onSome: (contentBlocks) => [joinParts(contentBlocks.map(blockText))]
                })
              ])
            )
          })),
        Match.when({ eventKind: "label" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: compact(
              joinParts([
                ...Option.match(Option.fromNullable(value.label), {
                  onNone: () => [],
                  onSome: (label) => [label]
                }),
                ...Option.match(Option.fromNullable(value.sessionName), {
                  onNone: () => [],
                  onSome: (sessionName) => [sessionName]
                }),
                ...Option.match(Option.fromNullable(value.contentBlocks), {
                  onNone: () => [],
                  onSome: (contentBlocks) => [joinParts(contentBlocks.map(blockText))]
                })
              ])
            )
          })),
        Match.when({ eventKind: "session-info" }, (value: OpenAgentTraceMetadataEvent) =>
          OpenAgentTraceDetailItem.make({
            label: `${value.eventKind} · ${value.eventId}`,
            detail: compact(
              joinParts([
                ...Option.match(Option.fromNullable(value.label), {
                  onNone: () => [],
                  onSome: (label) => [label]
                }),
                ...Option.match(Option.fromNullable(value.sessionName), {
                  onNone: () => [],
                  onSome: (sessionName) => [sessionName]
                }),
                ...Option.match(Option.fromNullable(value.contentBlocks), {
                  onNone: () => [],
                  onSome: (contentBlocks) => [joinParts(contentBlocks.map(blockText))]
                })
              ])
            )
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
          ...Option.match(Option.fromNullable(usage.provider), {
            onNone: () => [],
            onSome: (provider) => [String(provider)]
          }),
          ...Option.match(Option.fromNullable(usage.api), {
            onNone: () => [],
            onSome: (api) => [String(api)]
          }),
          ...Option.match(Option.fromNullable(usage.usage.inputTokens), {
            onNone: () => [],
            onSome: (value) => [`input ${String(value)}`]
          }),
          ...Option.match(Option.fromNullable(usage.usage.outputTokens), {
            onNone: () => [],
            onSome: (value) => [`output ${String(value)}`]
          }),
          ...Option.match(Option.fromNullable(usage.cacheReadTokens), {
            onNone: () => [],
            onSome: (value) => [`cache read ${String(value)}`]
          }),
          ...Option.match(Option.fromNullable(usage.totalTokens), {
            onNone: () => [],
            onSome: (value) => [`total ${String(value)}`]
          }),
          ...Option.match(Option.fromNullable(usage.costUsd), {
            onNone: () => [],
            onSome: (value) => [`cost ${String(value)}`]
          })
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
