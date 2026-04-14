import type { ReactNode } from "react"

import {
  workflowCanvasBodyStackClassName,
  workflowCanvasSupplementaryClassName
} from "../../recipes/workflow-canvas.recipe.js"
import { Box, mergeClassNames } from "../../structure/Box.js"
import { Stack } from "../../structure/Stack.js"
import {
  WorkspacePane,
  WorkspacePaneBody,
  WorkspacePaneFooter,
  WorkspacePaneHeader
} from "../workspace/WorkspacePane.js"
import { WorkspaceStatusRow } from "../workspace/WorkspaceStatusRow.js"

type WorkflowSetupCanvasProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly emptyState?: ReactNode
  readonly footer?: ReactNode
  readonly label?: ReactNode
  readonly statusItems?: ReadonlyArray<ReactNode>
  readonly summary?: ReactNode
  readonly title?: ReactNode
  readonly toolbar?: ReactNode
}

export const WorkflowSetupCanvas = ({
  actions,
  children,
  className,
  emptyState,
  footer,
  label,
  statusItems,
  summary,
  title,
  toolbar
}: WorkflowSetupCanvasProps) => (
  <WorkspacePane className={mergeClassNames("h-full", className)} variant="canvas">
    <WorkspacePaneHeader actions={actions} label={label} summary={summary} title={title} variant="canvas" />
    {statusItems === undefined && toolbar === undefined
      ? null
      : (
        <Box className={workflowCanvasSupplementaryClassName({})}>
          {statusItems === undefined ? null : <WorkspaceStatusRow items={statusItems} />}
          {toolbar}
        </Box>
      )}
    <WorkspacePaneBody className="flex min-h-0 flex-1 flex-col" scroll>
      {children === undefined
        ? emptyState
        : (
          <Stack className={workflowCanvasBodyStackClassName({})} gap="md">
            {children}
          </Stack>
        )}
    </WorkspacePaneBody>
    {footer === undefined ? null : <WorkspacePaneFooter variant="canvas">{footer}</WorkspacePaneFooter>}
  </WorkspacePane>
)
