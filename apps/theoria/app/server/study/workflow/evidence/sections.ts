import { workflowEntryDescriptor } from "../../../../contracts/entry/descriptors/workflow.js"
import {
  ComparisonItem,
  EvidenceSection,
  ScalarItem,
  TableItem,
  TextItem
} from "../../../../contracts/evidence/item.js"
import type { EvidenceStore } from "../../../../contracts/evidence/store.js"
import { presentationDetailRowsTableRows } from "../../../../contracts/presentation/detail-row.js"
import type { Program } from "../../../../contracts/presentation/program.js"
import { RunData } from "../../../../contracts/study/run.js"
import {
  workflowEvidenceItemKeys,
  workflowEvidenceItemLabels,
  workflowEvidenceSectionKeys,
  workflowEvidenceSectionTitleForSectionKey,
  workflowEvidenceTableColumns,
  workflowNodeExecutionSectionKey,
  workflowNodeExecutionSectionTitle,
  workflowNodeExecutionTotalTokens,
  workflowRuntimeEvidenceRows,
  workflowVariantOverviewSectionKey,
  workflowVariantOverviewSectionTitle
} from "../../../../contracts/study/workflow/evidence.js"
import type { WorkflowNodeExecution, WorkflowVariantExecution } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"

export type WorkflowVariantOverview = {
  readonly variant: WorkflowVariantExecution["variant"]
  readonly record: WorkflowVariantExecution["record"]
  readonly graphProjection: WorkflowVariantExecution["graphProjection"]
}

export const workflowOverviewSection = (workflowRun: FrozenWorkflowRun): EvidenceSection =>
  EvidenceSection.make({
    key: workflowEvidenceSectionKeys.overview,
    title: workflowEvidenceSectionTitleForSectionKey(workflowEvidenceSectionKeys.overview),
    items: [
      TextItem.make({ label: workflowEvidenceItemLabels.workflow, value: workflowRun.label, _tag: "Text" }),
      TextItem.make({ label: workflowEvidenceItemLabels.summary, value: workflowRun.summary, _tag: "Text" }),
      ComparisonItem.make({
        _tag: "Comparison",
        label: workflowEvidenceItemLabels.graphNodes,
        baseline: workflowRun.baseline.record.graph.nodes.length,
        improved: workflowRun.optimized.record.graph.nodes.length,
        unit: "count",
        direction: "higher-is-better"
      })
    ]
  })

export const variantOverviewSection = (execution: WorkflowVariantOverview): EvidenceSection =>
  EvidenceSection.make({
    key: workflowVariantOverviewSectionKey(execution.variant),
    title: workflowVariantOverviewSectionTitle(execution.variant),
    items: [
      TableItem.make({
        _tag: "Table",
        key: workflowEvidenceItemKeys.traversal,
        label: workflowEvidenceItemLabels.traversal,
        columns: [...workflowEvidenceTableColumns.variantTraversal],
        rows: execution.graphProjection.traversal.map((nodeId) => {
          const node = execution.record.graph.nodes.find((entry) => entry.nodeId === nodeId)

          return [nodeId, node?.nodeKind ?? "unknown", node?.runtimeRole ?? "unknown"]
        })
      }),
      ScalarItem.make({
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.traversalSteps,
        label: workflowEvidenceItemLabels.traversalSteps,
        value: execution.graphProjection.traversal.length,
        unit: "steps",
        format: "integer"
      })
    ]
  })

export const nodeExecutionSection = (execution: WorkflowNodeExecution): EvidenceSection =>
  (() => {
    const sectionKey = workflowNodeExecutionSectionKey({
      nodeId: execution.node.nodeId,
      nodeKind: execution.node.nodeKind,
      variant: execution.variant
    })

    return EvidenceSection.make({
      key: sectionKey,
      title: workflowNodeExecutionSectionTitle({
        nodeId: execution.node.nodeId,
        nodeKind: execution.node.nodeKind,
        variant: execution.variant
      }),
      items: [
        TextItem.make({
          _tag: "Text",
          key: workflowEvidenceItemKeys.output,
          label: workflowEvidenceItemLabels.output,
          value: execution.outputText
        }),
        TextItem.make({
          _tag: "Text",
          key: workflowEvidenceItemKeys.prompt,
          label: workflowEvidenceItemLabels.prompt,
          value: execution.trace.prompt
        }),
        TextItem.make({
          _tag: "Text",
          key: workflowEvidenceItemKeys.rawResponse,
          label: workflowEvidenceItemLabels.rawResponse,
          value: execution.trace.rawResponse
        }),
        ScalarItem.make({
          _tag: "Scalar",
          key: workflowEvidenceItemKeys.traceDuration,
          label: workflowEvidenceItemLabels.traceDuration,
          value: execution.trace.durationMs,
          unit: "ms",
          format: "fixed"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          key: workflowEvidenceItemKeys.totalTokens,
          label: workflowEvidenceItemLabels.totalTokens,
          value: workflowNodeExecutionTotalTokens(execution),
          unit: "tokens",
          format: "integer"
        }),
        TableItem.make({
          _tag: "Table",
          label: workflowEvidenceItemLabels.runtimeEvidence,
          columns: [...workflowEvidenceTableColumns.runtimeEvidence],
          rows: presentationDetailRowsTableRows(workflowRuntimeEvidenceRows(execution))
        })
      ]
    })
  })()

export const workflowDeltaSection = (
  baseline: WorkflowVariantExecution,
  optimized: WorkflowVariantExecution
): EvidenceSection =>
  EvidenceSection.make({
    key: workflowEvidenceSectionKeys.workflowDelta,
    title: workflowEvidenceSectionTitleForSectionKey(workflowEvidenceSectionKeys.workflowDelta),
    items: [
      ComparisonItem.make({
        _tag: "Comparison",
        key: workflowEvidenceItemKeys.aggregateScore,
        label: workflowEvidenceItemLabels.aggregateScore,
        baseline: baseline.report.aggregateScore,
        improved: optimized.report.aggregateScore,
        unit: "score",
        direction: "higher-is-better"
      }),
      ComparisonItem.make({
        _tag: "Comparison",
        key: workflowEvidenceItemKeys.graphNodes,
        label: workflowEvidenceItemLabels.graphNodes,
        baseline: baseline.record.graph.nodes.length,
        improved: optimized.record.graph.nodes.length,
        unit: "count",
        direction: "higher-is-better"
      })
    ]
  })

export const workflowRunDataFromStore = ({
  workflowRun,
  durationMs,
  program,
  store
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly durationMs: number
  readonly program: Program
  readonly store: EvidenceStore
}): RunData =>
  RunData.make({
    id: workflowRun.entryId,
    packageName: workflowEntryDescriptor.packageName,
    summary: workflowRun.summary,
    durationMs,
    program,
    sections: store.sections()
  })
