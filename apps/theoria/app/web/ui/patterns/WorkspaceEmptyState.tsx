import type { ReactNode } from "react"

import type { IconSource } from "../structure/Icon.js"

import { EmptyState } from "../components/feedback/EmptyState.js"
import { Panel } from "../components/surface/Panel.js"
import { Box, withClassName } from "../structure/Box.js"

type WorkspaceEmptyStateProps = {
  readonly action?: ReactNode
  readonly className?: string
  readonly description: ReactNode
  readonly eyebrow?: ReactNode
  readonly icon?: IconSource
  readonly title: ReactNode
}

export const WorkspaceEmptyState = (
  { action, className, description, eyebrow, icon, title }: WorkspaceEmptyStateProps
) => (
  <Panel padding="lg" tone="muted" {...withClassName(className)}>
    <Box className="flex min-h-[18rem] items-center justify-center">
      <EmptyState
        action={action}
        className="w-full max-w-[42rem] border-0 bg-transparent px-0 py-0"
        description={description}
        eyebrow={eyebrow}
        {...(icon === undefined ? {} : { icon })}
        title={title}
      />
    </Box>
  </Panel>
)
