import type { ReactNode } from "react"

import {
  workspaceStripActionsClassName,
  workspaceStripBodyClassName,
  workspaceStripClassName,
  workspaceStripSummaryClassName
} from "../../recipes/workspace-strip.recipe.js"
import { Box, type BoxProps, mergeClassNames } from "../../structure/Box.js"

import { WorkspacePane, WorkspacePaneBody, WorkspacePaneHeader } from "./WorkspacePane.js"

const stripSummary = (summary: ReactNode): ReactNode => (
  <Box className={workspaceStripSummaryClassName({})}>{summary}</Box>
)

const stripActions = (actions: ReactNode): ReactNode => (
  <Box className={workspaceStripActionsClassName({})}>{actions}</Box>
)

export type WorkspaceStripProps = Omit<BoxProps, "title"> & {
  readonly actions?: ReactNode
  readonly label?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

export const WorkspaceStrip = ({
  actions,
  children,
  className,
  label,
  summary,
  title,
  ...props
}: WorkspaceStripProps) => (
  <WorkspacePane {...props} className={mergeClassNames(workspaceStripClassName({}), className)} variant="strip">
    {label === undefined && summary === undefined && title === undefined && actions === undefined
      ? null
      : (
        <WorkspacePaneHeader
          actions={actions === undefined ? undefined : stripActions(actions)}
          label={label}
          summary={summary === undefined ? undefined : stripSummary(summary)}
          title={title}
          variant="strip"
        />
      )}
    {children === undefined
      ? null
      : <WorkspacePaneBody className={workspaceStripBodyClassName({})} density="compact">{children}</WorkspacePaneBody>}
  </WorkspacePane>
)
