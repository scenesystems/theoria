import type { ReactNode } from "react"

import { workflowPanelBodyClassName } from "../../recipes/workflow-panel.recipe.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { WorkspaceStatusRow } from "../workspace/WorkspaceStatusRow.js"

import { EvidencePanel } from "./EvidencePanel.js"
import { WorkflowDetailList } from "./WorkflowDetailList.js"
import { WorkflowSummaryBlock } from "./WorkflowSummaryBlock.js"

export type WorkflowResultsSummaryMetric = {
  readonly label: ReactNode
  readonly value: ReactNode
}

type WorkflowResultsSummaryPanelProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly emptyText?: ReactNode
  readonly headline: ReactNode
  readonly metrics?: ReadonlyArray<WorkflowResultsSummaryMetric>
  readonly statusItems?: ReadonlyArray<ReactNode>
  readonly summary?: ReactNode
  readonly supportingSummary?: ReactNode
  readonly title?: ReactNode
}

const emptyNode = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role="pane-meta">{value}</SemanticText>
    : value

export const WorkflowResultsSummaryPanel = ({
  actions,
  children,
  emptyText = "Primary workflow results will appear here once the study completes a run.",
  headline,
  metrics = [],
  statusItems,
  summary = "Frame the primary result before diving into diagnostics, evidence, or replay detail.",
  supportingSummary,
  title = "Results summary"
}: WorkflowResultsSummaryPanelProps) => (
  <EvidencePanel actions={actions} label="Workflow results" summary={summary} title={title}>
    <Stack className={workflowPanelBodyClassName({})} gap="md">
      {statusItems === undefined ? null : <WorkspaceStatusRow items={statusItems} />}
      <WorkflowSummaryBlock summary={supportingSummary} title={headline} />
      {metrics.length === 0
        ? emptyNode(emptyText)
        : <WorkflowDetailList items={metrics} />}
      {children}
    </Stack>
  </EvidencePanel>
)
