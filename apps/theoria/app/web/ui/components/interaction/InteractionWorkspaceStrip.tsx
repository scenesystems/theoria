import type { ComponentProps } from "react"

import { WorkspaceStrip } from "../workspace/WorkspaceStrip.js"

export type InteractionWorkspaceStripProps = ComponentProps<typeof WorkspaceStrip>

export const InteractionWorkspaceStrip = (props: InteractionWorkspaceStripProps) => <WorkspaceStrip {...props} />
