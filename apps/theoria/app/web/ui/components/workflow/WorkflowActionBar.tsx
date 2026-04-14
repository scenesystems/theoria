import type { ComponentProps } from "react"

import { WorkspaceActionBar } from "../workspace/WorkspaceActionBar.js"

export type WorkflowActionBarProps = ComponentProps<typeof WorkspaceActionBar>

export const WorkflowActionBar = (props: WorkflowActionBarProps) => <WorkspaceActionBar {...props} />
