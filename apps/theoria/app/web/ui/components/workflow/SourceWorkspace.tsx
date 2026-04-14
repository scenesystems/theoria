import type { ReactNode } from "react"

import {
  WorkspacePane,
  WorkspacePaneBody,
  WorkspacePaneFooter,
  WorkspacePaneHeader
} from "../workspace/WorkspacePane.js"

type SourceWorkspaceProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly footer?: ReactNode
  readonly label?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
  readonly toolbar?: ReactNode
}

export const SourceWorkspace = ({
  actions,
  children,
  className,
  footer,
  label,
  summary,
  title,
  toolbar
}: SourceWorkspaceProps) => (
  <WorkspacePane {...(className === undefined ? {} : { className })} variant="support">
    <WorkspacePaneHeader actions={actions} label={label} summary={summary} title={title} variant="support" />
    {toolbar}
    <WorkspacePaneBody className="flex min-h-0 flex-1 flex-col" padded={false} scroll>
      {children}
    </WorkspacePaneBody>
    {footer === undefined ? null : <WorkspacePaneFooter variant="support">{footer}</WorkspacePaneFooter>}
  </WorkspacePane>
)
