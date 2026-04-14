import type { ReactNode } from "react"

import type { WorkflowPlanSummaryMetricRow } from "../../../../contracts/study/workflow/plan-presentation.js"
import { SemanticText } from "../../structure/SemanticText.js"

import { SourceWorkspace } from "./SourceWorkspace.js"
import { WorkflowDetailList } from "./WorkflowDetailList.js"
import { WorkflowSummaryBlock } from "./WorkflowSummaryBlock.js"

type WorkflowRunPlanPanelProps = {
  readonly actions?: ReactNode
  readonly currentWorkflowLabel: string
  readonly currentWorkflowSummary: string
  readonly emptyText?: ReactNode
  readonly metrics: ReadonlyArray<WorkflowPlanSummaryMetricRow>
  readonly phaseDetail?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

const emptyNode = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role="pane-meta">{value}</SemanticText>
    : value

export const WorkflowRunPlanPanel = ({
  actions,
  currentWorkflowLabel,
  currentWorkflowSummary,
  emptyText,
  metrics,
  phaseDetail,
  summary = "Operationalize the current study into a readable execution plan before you run it.",
  title = "Run plan"
}: WorkflowRunPlanPanelProps) => (
  <SourceWorkspace actions={actions} label="Workflow plan" summary={summary} title={title}>
    <WorkflowSummaryBlock summary={currentWorkflowSummary} title={currentWorkflowLabel} />
    {metrics.length === 0
      ? emptyNode(emptyText)
      : (
        <WorkflowDetailList
          items={metrics.map((metric) => ({
            label: metric.label,
            value: metric.unit === undefined ? metric.value : `${metric.value} ${metric.unit}`
          }))}
        />
      )}
    {phaseDetail === undefined ? null : <WorkflowSummaryBlock summary={phaseDetail} title="Current state" />}
  </SourceWorkspace>
)
