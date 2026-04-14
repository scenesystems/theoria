import type { ReactNode } from "react"

import { WorkspacePane, WorkspacePaneBody, WorkspacePaneHeader } from "../workspace/WorkspacePane.js"

type InteractionInspectorProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly label?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

export const InteractionInspector = ({
  actions,
  children,
  className,
  label,
  summary,
  title
}: InteractionInspectorProps) => (
  <WorkspacePane {...(className === undefined ? {} : { className })} variant="inspector">
    <WorkspacePaneHeader actions={actions} label={label} summary={summary} title={title} variant="inspector" />
    <WorkspacePaneBody className="flex min-h-0 flex-1 flex-col" padded={false} scroll>
      {children}
    </WorkspacePaneBody>
  </WorkspacePane>
)
