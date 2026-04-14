import type { ReactNode } from "react"

import {
  workflowPanelBodyClassName,
  workflowPanelSectionControlsClassName
} from "../../recipes/workflow-panel.recipe.js"
import { Box } from "../../structure/Box.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { WorkspaceStatusRow } from "../workspace/WorkspaceStatusRow.js"

import { SourceWorkspace } from "./SourceWorkspace.js"
import { WorkflowSummaryBlock } from "./WorkflowSummaryBlock.js"

export type WorkflowScenarioSelectorOption = {
  readonly active: boolean
  readonly disabled?: boolean
  readonly key: string
  readonly label: ReactNode
  readonly onSelect?: () => void
}

type WorkflowScenarioSelectorPanelProps = {
  readonly actions?: ReactNode
  readonly currentWorkflowLabel: ReactNode
  readonly currentWorkflowSummary: ReactNode
  readonly description?: ReactNode
  readonly options: ReadonlyArray<WorkflowScenarioSelectorOption>
  readonly statusItems?: ReadonlyArray<ReactNode>
  readonly title?: ReactNode
}

export const WorkflowScenarioSelectorPanel = ({
  actions,
  currentWorkflowLabel,
  currentWorkflowSummary,
  description = "Choose the workflow scenario that should own the current proving run.",
  options,
  statusItems,
  title = "Workflow selector"
}: WorkflowScenarioSelectorPanelProps) => (
  <SourceWorkspace actions={actions} label="Workflow study" summary={description} title={title}>
    <Stack className={workflowPanelBodyClassName({})} gap="md">
      {statusItems === undefined ? null : <WorkspaceStatusRow items={statusItems} />}
      <WorkflowSummaryBlock summary={currentWorkflowSummary} title={currentWorkflowLabel} />
      <Box className={workflowPanelSectionControlsClassName({})}>
        {options.map((option) => (
          <Button
            disabled={option.disabled === true || option.onSelect === undefined}
            key={option.key}
            onClick={option.onSelect}
            size="sm"
            tone={option.active ? "primary" : "neutral"}
          >
            {option.label}
          </Button>
        ))}
      </Box>
    </Stack>
  </SourceWorkspace>
)
