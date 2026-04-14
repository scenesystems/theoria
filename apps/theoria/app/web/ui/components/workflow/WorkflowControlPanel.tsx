import type { ReactNode } from "react"

import {
  workflowPanelBodyClassName,
  workflowPanelSectionClassName,
  workflowPanelSectionControlsClassName,
  workflowPanelSectionCopyClassName,
  workflowPanelSectionHeaderClassName
} from "../../recipes/workflow-panel.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { WorkspaceStatusRow } from "../workspace/WorkspaceStatusRow.js"

import { SourceWorkspace } from "./SourceWorkspace.js"

export type WorkflowControlOption = {
  readonly active: boolean
  readonly disabled?: boolean
  readonly key: string
  readonly label: ReactNode
  readonly onSelect?: () => void
}

export type WorkflowControlSection = {
  readonly description: ReactNode
  readonly key: string
  readonly options: ReadonlyArray<WorkflowControlOption>
  readonly title: ReactNode
}

type WorkflowControlPanelProps = {
  readonly actions?: ReactNode
  readonly emptyText?: ReactNode
  readonly sections: ReadonlyArray<WorkflowControlSection>
  readonly statusItems?: ReadonlyArray<ReactNode>
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

const semanticNode = (value: ReactNode, role: "pane-title" | "pane-summary"): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role={role}>{value}</SemanticText>
    : value

export const WorkflowControlPanel = ({
  actions,
  emptyText = "Workflow controls will appear here once the study exposes bounded setup choices.",
  sections,
  statusItems,
  summary = "Shape the run like a toolbench: bounded controls, compact choices, and no dashboard sprawl.",
  title = "Setup controls"
}: WorkflowControlPanelProps) => (
  <SourceWorkspace actions={actions} label="Workflow setup" summary={summary} title={title}>
    <Stack className={workflowPanelBodyClassName({})} gap="md">
      {statusItems === undefined ? null : <WorkspaceStatusRow items={statusItems} />}
      {sections.length === 0
        ? emptyText
        : sections.map((section) => (
          <Box className={workflowPanelSectionClassName({})} key={section.key}>
            <Box className={workflowPanelSectionHeaderClassName({})}>
              <Box className={workflowPanelSectionCopyClassName({})}>
                {semanticNode(section.title, "pane-title")}
                {semanticNode(section.description, "pane-summary")}
              </Box>
              <Box className={workflowPanelSectionControlsClassName({})}>
                {section.options.map((option) => (
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
            </Box>
          </Box>
        ))}
    </Stack>
  </SourceWorkspace>
)
