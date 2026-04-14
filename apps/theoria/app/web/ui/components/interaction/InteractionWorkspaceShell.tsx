import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../../structure/Box.js"
import { Stack } from "../../structure/Stack.js"
import { WorkspaceSplitLayout } from "../workspace/WorkspaceSplitLayout.js"
import { WorkspaceStatusRow } from "../workspace/WorkspaceStatusRow.js"

import { InteractionWorkspaceStrip } from "./InteractionWorkspaceStrip.js"

type InteractionWorkspaceShellProps = {
  readonly actions?: ReactNode
  readonly className?: string
  readonly inspector: ReactNode
  readonly label?: ReactNode
  readonly summary?: ReactNode
  readonly stripBody?: ReactNode
  readonly title?: ReactNode
  readonly transcript: ReactNode
  readonly statusItems?: ReadonlyArray<ReactNode>
}

export const InteractionWorkspaceShell = ({
  actions,
  className,
  inspector,
  label,
  stripBody,
  statusItems,
  summary,
  title,
  transcript
}: InteractionWorkspaceShellProps) => (
  <Stack
    className={mergeClassNames(
      "min-h-0 flex-1 bg-surface-workspace px-[var(--ui-workspace-shell-gutter)] py-[var(--ui-workspace-shell-gutter)]",
      className
    )}
    gap="md"
  >
    <InteractionWorkspaceStrip actions={actions} label={label} summary={summary} title={title}>
      {statusItems === undefined ? null : <WorkspaceStatusRow items={statusItems} />}
      {stripBody}
    </InteractionWorkspaceStrip>
    <Box className="min-h-0 flex-1">
      <WorkspaceSplitLayout className="h-full" primary={transcript} secondary={inspector} />
    </Box>
  </Stack>
)
