import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../../structure/Box.js"
import {
  WorkspacePane,
  WorkspacePaneBody,
  WorkspacePaneFooter,
  WorkspacePaneHeader
} from "../workspace/WorkspacePane.js"

type InteractionTranscriptCanvasProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly composer?: ReactNode
  readonly label?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
  readonly toolbar?: ReactNode
}

export const InteractionTranscriptCanvas = ({
  actions,
  children,
  className,
  composer,
  label,
  summary,
  title,
  toolbar
}: InteractionTranscriptCanvasProps) => (
  <WorkspacePane className={mergeClassNames("h-full", className)} variant="canvas">
    <WorkspacePaneHeader actions={actions} label={label} summary={summary} title={title} variant="canvas" />
    {toolbar}
    <WorkspacePaneBody className="flex min-h-0 flex-1 flex-col" padded={false}>
      <Box className="min-h-0 flex-1">{children}</Box>
    </WorkspacePaneBody>
    {composer === undefined ? null : <WorkspacePaneFooter variant="canvas">{composer}</WorkspacePaneFooter>}
  </WorkspacePane>
)
