import { Option } from "effect"
import * as Arr from "effect/Array"

import type { OpenAgentTraceRegistryEntry } from "../../../../contracts/study/workflow/open-agent-trace.js"
import type { CoverageItem, DetailItem, SummaryRow } from "./panel-types.js"

type CoverageGap = OpenAgentTraceRegistryEntry["workflowProjection"]["coverageGaps"][number]
type WorkflowRecord = OpenAgentTraceRegistryEntry["workflowProjection"]["workflowRecord"]
type WorkflowNode = WorkflowRecord["graph"]["nodes"][number]
type WorkflowEdge = WorkflowRecord["graph"]["edges"][number]
type WorkflowEvaluationCase = WorkflowRecord["evaluation"]["cases"][number]
type UsageProvenance = OpenAgentTraceRegistryEntry["workflowProjection"]["usageProvenance"][number]

const compact = (text: string, max = 140): string => text.length > max ? `${text.slice(0, max).trimEnd()}…` : text

const joinParts = (parts: ReadonlyArray<string>): string =>
  Arr.join(Arr.filter(parts, (part) => part.trim().length > 0), " · ")

const workflowNodeDetail = (node: WorkflowNode): string =>
  joinParts([
    node.runtimeRole,
    `${Arr.join(node.inputLanes, ", ")} -> ${node.outputLane}`,
    node.loopPolicy,
    node.optimizationKnobRefs.length === 0
      ? "no released knobs"
      : `knobs: ${Arr.join(node.optimizationKnobRefs, ", ")}`
  ])

const usageDetail = (usage: UsageProvenance): string =>
  joinParts([
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

const usageLabel = (usage: UsageProvenance): string =>
  `${usage.eventId} · ${
    Option.match(Option.fromNullable(usage.model), {
      onNone: () => "n/a",
      onSome: (model) => String(model)
    })
  }`

export const coverageItemsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<CoverageItem> =>
  entry.workflowProjection.coverageGaps.map((gap: CoverageGap) => ({
    detail: gap.reason,
    label: `${gap.sourceKind} · ${gap.gapId}`,
    severity: gap.severity
  }))

export const graphEdgeItemsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<DetailItem> =>
  entry.workflowProjection.workflowRecord.graph.edges.map((edge: WorkflowEdge) => ({
    label: edge.edgeId,
    detail: `${edge.fromNodeId} -> ${edge.toNodeId} · ${edge.kind}`
  }))

export const graphNodeItemsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<DetailItem> =>
  entry.workflowProjection.workflowRecord.graph.nodes.map((node: WorkflowNode) => ({
    label: node.nodeId,
    detail: workflowNodeDetail(node)
  }))

export const usageItemsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<DetailItem> =>
  entry.workflowProjection.usageProvenance.map((usage: UsageProvenance) => ({
    label: usageLabel(usage),
    detail: usageDetail(usage)
  }))

export const workflowCaseItemsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<DetailItem> =>
  entry.workflowProjection.workflowRecord.evaluation.cases.map((evaluationCase: WorkflowEvaluationCase) => ({
    label: evaluationCase.caseId,
    detail: compact(
      joinParts([
        evaluationCase.prompt,
        `signals ${Arr.join(evaluationCase.expectedSignals, ", ")}`,
        evaluationCase.renderCritical ? "render critical" : "render supportive"
      ]),
      220
    )
  }))

export const workflowRowsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<SummaryRow> => {
  const workflowRecord = entry.workflowProjection.workflowRecord

  return [
    { label: "Workflow Kind", value: workflowRecord.workflowKind },
    { label: "Session", value: workflowRecord.session.sessionId },
    { label: "Nodes", value: String(workflowRecord.graph.nodes.length) },
    { label: "Edges", value: String(workflowRecord.graph.edges.length) },
    { label: "Evaluation Cases", value: String(workflowRecord.evaluation.cases.length) }
  ]
}
