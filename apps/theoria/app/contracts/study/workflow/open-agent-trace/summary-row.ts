import { Match, Option, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import type { OpenAgentTraceCorpusLane } from "./corpus-lane.js"
import { type OpenAgentTraceSummaryRowKey } from "./panel-presentation.js"
import { type OpenAgentTracePanelData, type OpenAgentTraceRegistryEntry } from "./study-material.js"

const openAgentTraceSummaryRowKeys: ReadonlyArray<OpenAgentTraceSummaryRowKey> = [
  "records",
  "coverage-gaps",
  "consumer-artifacts",
  "corpus-lane",
  "workflow-hookups"
]

export class OpenAgentTraceSummaryRow extends Schema.Class<OpenAgentTraceSummaryRow>("OpenAgentTraceSummaryRow")({
  label: Schema.String,
  value: Schema.String
}) {
  static label(key: OpenAgentTraceSummaryRowKey): string {
    return Match.value(key).pipe(
      Match.withReturnType<string>(),
      Match.when("records", () => "Records"),
      Match.when("coverage-gaps", () => "Coverage Gaps"),
      Match.when("consumer-artifacts", () => "Consumer Artifacts"),
      Match.when("corpus-lane", () => "Corpus Lane"),
      Match.when("workflow-hookups", () => "Workflow Hookups"),
      Match.exhaustive
    )
  }

  private static value({
    corpusLane,
    coverageGapCount,
    data,
    key
  }: {
    readonly corpusLane: OpenAgentTraceCorpusLane
    readonly coverageGapCount: number
    readonly data: OpenAgentTracePanelData
    readonly key: OpenAgentTraceSummaryRowKey
  }): string {
    return Match.value(key).pipe(
      Match.withReturnType<string>(),
      Match.when("records", () => `${data.registry.length}`),
      Match.when("coverage-gaps", () => `${coverageGapCount}`),
      Match.when("consumer-artifacts", () => `${data.studyMaterialCount("consumer-artifacts")}`),
      Match.when("corpus-lane", () => corpusLane.label),
      Match.when("workflow-hookups", () => `${data.studyMaterialCount("workflow-hookups")}`),
      Match.exhaustive
    )
  }

  static summarize({
    corpusLane,
    data
  }: {
    readonly corpusLane: OpenAgentTraceCorpusLane
    readonly data: OpenAgentTracePanelData
  }): ReadonlyArray<OpenAgentTraceSummaryRow> {
    const coverageGapCount = data.registry.reduce(
      (total, entry) => total + entry.workflowProjection.coverageGaps.length,
      0
    )

    return openAgentTraceSummaryRowKeys.map((key) =>
      OpenAgentTraceSummaryRow.make({
        label: OpenAgentTraceSummaryRow.label(key),
        value: OpenAgentTraceSummaryRow.value({ corpusLane, coverageGapCount, data, key })
      })
    )
  }

  static digests(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceSummaryRow> {
    return [
      OpenAgentTraceSummaryRow.make({
        label: "Source Digest",
        value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.sourceDigest)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Normalized Digest",
        value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.normalizedDigest)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Redacted Digest",
        value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.redactedDigest)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Published Hash",
        value: Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(entry.record.source.redactedHash)
      })
    ]
  }

  static redactionStatus(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceSummaryRow> {
    return [
      OpenAgentTraceSummaryRow.make({
        label: "Projection Safe",
        value: String(entry.record.reviewStatus.projectionSafe)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Manual Review",
        value: String(entry.record.reviewStatus.manualReviewRequired)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Semantic Review",
        value: entry.record.reviewStatus.semanticReviewStatus
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Redaction Findings",
        value: String(entry.record.redactionFindings.length)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Policy",
        value: `${entry.record.reviewStatus.policyId} v${String(entry.record.reviewStatus.policyVersion)}`
      })
    ]
  }

  static source(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceSummaryRow> {
    return [
      OpenAgentTraceSummaryRow.make({ label: "Artifact", value: entry.consumerArtifact.title }),
      OpenAgentTraceSummaryRow.make({ label: "Dataset", value: entry.record.source.datasetId }),
      OpenAgentTraceSummaryRow.make({ label: "Revision", value: entry.record.source.datasetRevision }),
      OpenAgentTraceSummaryRow.make({ label: "Split", value: entry.record.source.split }),
      OpenAgentTraceSummaryRow.make({
        label: "Source Family",
        value: entry.consumerArtifact.sourceFamilyLabel()
      }),
      OpenAgentTraceSummaryRow.make({ label: "Session", value: entry.record.session.sessionId }),
      OpenAgentTraceSummaryRow.make({ label: "File", value: entry.record.source.fileName }),
      OpenAgentTraceSummaryRow.make({ label: "Harness", value: entry.record.source.harness }),
      OpenAgentTraceSummaryRow.make({ label: "Selection", value: entry.record.selection.selectionPolicy }),
      OpenAgentTraceSummaryRow.make({
        label: "Active Path",
        value: String(entry.record.selection.activePathEntryIds.length)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Compacted Path",
        value: String(entry.record.selection.compactedPathEntryIds.length)
      }),
      OpenAgentTraceSummaryRow.make({
        label: "Parent Session",
        value: Option.match(Option.fromNullable(entry.record.session.parentSession), {
          onNone: () => "n/a",
          onSome: (parentSession) => String(parentSession)
        })
      })
    ]
  }

  static workflow(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceSummaryRow> {
    const workflowRecord = entry.workflowProjection.workflowRecord

    return [
      OpenAgentTraceSummaryRow.make({ label: "Workflow Kind", value: workflowRecord.workflowKind }),
      OpenAgentTraceSummaryRow.make({
        label: "Hookup",
        value: `${entry.workflowHookup.sourceKind} · ${entry.workflowHookup.transport}`
      }),
      OpenAgentTraceSummaryRow.make({ label: "Session", value: workflowRecord.session.sessionId }),
      OpenAgentTraceSummaryRow.make({ label: "Nodes", value: String(workflowRecord.graph.nodes.length) }),
      OpenAgentTraceSummaryRow.make({ label: "Edges", value: String(workflowRecord.graph.edges.length) }),
      OpenAgentTraceSummaryRow.make({
        label: "Evaluation Cases",
        value: String(workflowRecord.evaluation.cases.length)
      })
    ]
  }
}
