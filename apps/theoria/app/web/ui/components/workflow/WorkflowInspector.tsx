import type { ReactNode } from "react"

import {
  WorkspacePane,
  WorkspacePaneBody,
  WorkspacePaneFooter,
  WorkspacePaneHeader
} from "../workspace/WorkspacePane.js"

type WorkflowInspectorProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly footer?: ReactNode
  readonly label?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

export const WorkflowInspector = ({
  actions,
  children,
  className,
  footer,
  label,
  summary,
  title
}: WorkflowInspectorProps) => (
  <WorkspacePane {...(className === undefined ? {} : { className })} variant="inspector">
    <WorkspacePaneHeader actions={actions} label={label} summary={summary} title={title} variant="inspector" />
    <WorkspacePaneBody className="flex min-h-0 flex-1 flex-col" padded={false} scroll>
      {children}
    </WorkspacePaneBody>
    {footer === undefined ? null : <WorkspacePaneFooter variant="inspector">{footer}</WorkspacePaneFooter>}
  </WorkspacePane>
)
