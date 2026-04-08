import { Option } from "effect"
import * as Experimental from "effect-dsp/experimental"

import type { OpenAgentTraceRegistryEntry } from "../../../../contracts/study/workflow/open-agent-trace.js"
import type { DetailItem, SummaryRow } from "./panel-types.js"

type BranchRecord = OpenAgentTraceRegistryEntry["record"]["branches"][number]

const joinParts = (parts: ReadonlyArray<string>): string =>
  parts.flatMap((part) => part.trim().length === 0 ? [] : [part]).join(" · ")

const branchDetail = (branch: BranchRecord): string =>
  joinParts([
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

const optionalValue = (value: Option.Option<string | number>): string =>
  Option.match(value, {
    onNone: () => "n/a",
    onSome: (presentValue) => String(presentValue)
  })

export const branchItemsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<DetailItem> =>
  entry.record.branches.map((branch: BranchRecord) => ({
    label: branch.branchId,
    detail: branchDetail(branch)
  }))

export const digestRowsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<SummaryRow> => [
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
]

export const redactionRowsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<SummaryRow> => [
  { label: "Projection Safe", value: String(entry.record.reviewStatus.projectionSafe) },
  { label: "Manual Review", value: String(entry.record.reviewStatus.manualReviewRequired) },
  { label: "Semantic Review", value: entry.record.reviewStatus.semanticReviewStatus },
  { label: "Redaction Findings", value: String(entry.record.redactionFindings.length) },
  {
    label: "Policy",
    value: `${entry.record.reviewStatus.policyId} v${String(entry.record.reviewStatus.policyVersion)}`
  }
]

export const sourceRowsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<SummaryRow> => [
  { label: "Dataset", value: entry.record.source.datasetId },
  { label: "Revision", value: entry.record.source.datasetRevision },
  { label: "Split", value: entry.record.source.split },
  { label: "Session", value: entry.record.session.sessionId },
  { label: "File", value: entry.record.source.fileName },
  { label: "Harness", value: entry.record.source.harness },
  { label: "Selection", value: entry.record.selection.selectionPolicy },
  { label: "Active Path", value: String(entry.record.selection.activePathEntryIds.length) },
  { label: "Compacted Path", value: String(entry.record.selection.compactedPathEntryIds.length) },
  { label: "Parent Session", value: optionalValue(Option.fromNullable(entry.record.session.parentSession)) }
]
