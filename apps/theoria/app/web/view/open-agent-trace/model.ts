import { Match, Option } from "effect"
import * as Experimental from "effect-dsp/experimental"
import * as Arr from "effect/Array"

import type { OpenAgentTraceRegistryEntry } from "../../../contracts/open-agent-trace.js"

type SummaryRow = {
  readonly label: string
  readonly value: string
}

type BranchItem = {
  readonly label: string
  readonly detail: string
}

type CoverageItem = {
  readonly detail: string
  readonly label: string
  readonly severity: string
}

type GraphItem = {
  readonly detail: string
  readonly label: string
}

export type OpenAgentTraceEntryPageModel = {
  readonly branchItems: ReadonlyArray<BranchItem>
  readonly coverageItems: ReadonlyArray<CoverageItem>
  readonly digestRows: ReadonlyArray<SummaryRow>
  readonly entryId: OpenAgentTraceRegistryEntry["entryId"]
  readonly graphEdgeItems: ReadonlyArray<GraphItem>
  readonly graphNodeItems: ReadonlyArray<GraphItem>
  readonly redactionRows: ReadonlyArray<SummaryRow>
  readonly sourceHref: string
  readonly sourceRows: ReadonlyArray<SummaryRow>
  readonly summary: string
  readonly title: string
  readonly workflowRows: ReadonlyArray<SummaryRow>
}

export type OpenAgentTracePageModel = {
  readonly entries: ReadonlyArray<OpenAgentTraceEntryPageModel>
  readonly summaryRows: ReadonlyArray<SummaryRow>
}

const formatOptional = (value: Option.Option<string | number>): string =>
  Option.match(value, {
    onNone: () => "n/a",
    onSome: (presentValue) => String(presentValue)
  })

const branchDetail = (branch: OpenAgentTraceRegistryEntry["record"]["branches"][number]): string =>
  Arr.join(
    Arr.filter([
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
    ], (part) => part.length > 0),
    " · "
  )

const graphNodeDetail = (
  node: OpenAgentTraceRegistryEntry["workflowProjection"]["workflowRecord"]["graph"]["nodes"][number]
): string =>
  Arr.join(
    [
      `${node.runtimeRole}`,
      `${Arr.join(node.inputLanes, ", ")} -> ${node.outputLane}`,
      node.loopPolicy,
      node.optimizationKnobRefs.length === 0
        ? "no released knobs"
        : `knobs: ${Arr.join(node.optimizationKnobRefs, ", ")}`
    ],
    " · "
  )

const graphEdgeDetail = (
  edge: OpenAgentTraceRegistryEntry["workflowProjection"]["workflowRecord"]["graph"]["edges"][number]
): string => `${edge.fromNodeId} -> ${edge.toNodeId} · ${edge.kind}`

const coverageDetail = (
  gap: OpenAgentTraceRegistryEntry["workflowProjection"]["coverageGaps"][number]
): CoverageItem => ({
  detail: gap.reason,
  label: `${gap.sourceKind} · ${gap.gapId}`,
  severity: gap.severity
})

const workflowSummaryRows = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<SummaryRow> => {
  const workflowRecord = entry.workflowProjection.workflowRecord

  return [
    { label: "Workflow Kind", value: workflowRecord.workflowKind },
    { label: "Session", value: workflowRecord.session.sessionId },
    { label: "Nodes", value: String(workflowRecord.graph.nodes.length) },
    { label: "Edges", value: String(workflowRecord.graph.edges.length) },
    { label: "Evaluation Cases", value: String(workflowRecord.evaluation.cases.length) }
  ]
}

const entryModel = (entry: OpenAgentTraceRegistryEntry): OpenAgentTraceEntryPageModel => ({
  branchItems: entry.record.branches.map((branch) => ({
    label: branch.branchId,
    detail: branchDetail(branch)
  })),
  coverageItems: entry.workflowProjection.coverageGaps.map(coverageDetail),
  digestRows: [
    {
      label: "Source Digest",
      value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.sourceDigest)
    },
    {
      label: "Normalized Digest",
      value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.normalizedDigest)
    },
    {
      label: "Redacted Digest",
      value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.redactedDigest)
    },
    {
      label: "Published Hash",
      value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.source.redactedHash)
    }
  ],
  entryId: entry.entryId,
  graphEdgeItems: entry.workflowProjection.workflowRecord.graph.edges.map((edge) => ({
    label: edge.edgeId,
    detail: graphEdgeDetail(edge)
  })),
  graphNodeItems: entry.workflowProjection.workflowRecord.graph.nodes.map((node) => ({
    label: node.nodeId,
    detail: graphNodeDetail(node)
  })),
  redactionRows: [
    { label: "Projection Safe", value: String(entry.record.reviewStatus.projectionSafe) },
    { label: "Manual Review", value: String(entry.record.reviewStatus.manualReviewRequired) },
    { label: "Semantic Review", value: entry.record.reviewStatus.semanticReviewStatus },
    { label: "Redaction Findings", value: String(entry.record.redactionFindings.length) },
    {
      label: "Policy",
      value: `${entry.record.reviewStatus.policyId} v${String(entry.record.reviewStatus.policyVersion)}`
    }
  ],
  sourceHref: entry.record.source.sourceUrl,
  sourceRows: [
    { label: "Dataset", value: entry.record.source.datasetId },
    { label: "Revision", value: entry.record.source.datasetRevision },
    { label: "Split", value: entry.record.source.split },
    { label: "Session", value: entry.record.session.sessionId },
    { label: "File", value: entry.record.source.fileName },
    { label: "Harness", value: entry.record.source.harness },
    { label: "Selection", value: entry.record.selection.selectionPolicy },
    { label: "Active Path", value: String(entry.record.selection.activePathEntryIds.length) },
    { label: "Compacted Path", value: String(entry.record.selection.compactedPathEntryIds.length) },
    {
      label: "Parent Session",
      value: formatOptional(Option.fromNullable(entry.record.session.parentSession))
    }
  ],
  summary: entry.summary,
  title: entry.title,
  workflowRows: workflowSummaryRows(entry)
})

export const openAgentTracePageModel = (
  entries: ReadonlyArray<OpenAgentTraceRegistryEntry>
): OpenAgentTracePageModel => ({
  entries: entries.map(entryModel),
  summaryRows: [
    { label: "Records", value: String(entries.length) },
    {
      label: "Coverage Gaps",
      value: String(entries.reduce((total, entry) => total + entry.workflowProjection.coverageGaps.length, 0))
    },
    {
      label: "Experimental Surface",
      value: Match.value(entries.length > 0).pipe(
        Match.when(true, () => "fixture-backed"),
        Match.orElse(() => "empty")
      )
    }
  ]
})
