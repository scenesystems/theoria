import type { ComponentProps, ReactNode } from "react"

import { Stack } from "../../structure/Stack.js"
import { DetailList } from "../detail/DetailList.js"
import {
  WorkspacePane,
  WorkspacePaneBody,
  WorkspacePaneFooter,
  WorkspacePaneHeader
} from "../workspace/WorkspacePane.js"

type EvidencePanelProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly details?: ComponentProps<typeof DetailList>["items"]
  readonly emptyText?: ReactNode
  readonly footer?: ReactNode
  readonly label?: ReactNode
  readonly payload?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

export const EvidencePanel = ({
  actions,
  children,
  className,
  details,
  emptyText,
  footer,
  label,
  payload,
  summary,
  title
}: EvidencePanelProps) => (
  <WorkspacePane {...(className === undefined ? {} : { className })} variant="support">
    <WorkspacePaneHeader actions={actions} label={label} summary={summary} title={title} variant="support" />
    <WorkspacePaneBody className="flex min-h-0 flex-1 flex-col" scroll>
      <Stack gap="md">
        {details === undefined ? null : <DetailList emptyText={emptyText} items={details} />}
        {payload}
        {children}
      </Stack>
    </WorkspacePaneBody>
    {footer === undefined ? null : <WorkspacePaneFooter variant="support">{footer}</WorkspacePaneFooter>}
  </WorkspacePane>
)
