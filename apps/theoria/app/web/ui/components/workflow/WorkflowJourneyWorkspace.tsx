import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../../structure/Box.js"
import { Stack } from "../../structure/Stack.js"
import { WorkspaceSplitLayout } from "../workspace/WorkspaceSplitLayout.js"
import { WorkspaceStatusRow } from "../workspace/WorkspaceStatusRow.js"

import { WorkflowWorkspaceStrip } from "./WorkflowWorkspaceStrip.js"

type WorkflowJourneyWorkspaceProps = {
  readonly actions?: ReactNode
  readonly actionBar?: ReactNode
  readonly canvas: ReactNode
  readonly className?: string
  readonly inspector: ReactNode
  readonly label?: ReactNode
  readonly statusItems?: ReadonlyArray<ReactNode>
  readonly stripBody?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

export const WorkflowJourneyWorkspace = ({
  actions,
  actionBar,
  canvas,
  className,
  inspector,
  label,
  statusItems,
  stripBody,
  summary,
  title
}: WorkflowJourneyWorkspaceProps) => (
  <Stack
    className={mergeClassNames(
      "min-h-0 flex-1 bg-surface-workspace px-[var(--ui-workspace-shell-gutter)] py-[var(--ui-workspace-shell-gutter)]",
      className
    )}
    gap="md"
  >
    <WorkflowWorkspaceStrip actions={actions} label={label} summary={summary} title={title}>
      {statusItems === undefined ? null : <WorkspaceStatusRow items={statusItems} />}
      {stripBody}
    </WorkflowWorkspaceStrip>
    {actionBar}
    <Box className="min-h-0 flex-1">
      <WorkspaceSplitLayout className="h-full" primary={canvas} secondary={inspector} />
    </Box>
  </Stack>
)
