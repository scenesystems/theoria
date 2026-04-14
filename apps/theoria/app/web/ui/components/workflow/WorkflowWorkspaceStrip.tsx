import type { ComponentProps } from "react"

import { WorkspaceStrip } from "../workspace/WorkspaceStrip.js"

export type WorkflowWorkspaceStripProps = ComponentProps<typeof WorkspaceStrip>

export const WorkflowWorkspaceStrip = (props: WorkflowWorkspaceStripProps) => <WorkspaceStrip {...props} />
