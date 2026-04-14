import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../structure/Box.js"

type WorkspaceFrameProps = {
  readonly bodyClassName?: string
  readonly children: ReactNode
  readonly className?: string
  readonly header?: ReactNode
  readonly navigation?: ReactNode
  readonly status?: ReactNode
}

export const WorkspaceFrame = ({
  bodyClassName,
  children,
  className,
  header,
  navigation,
  status
}: WorkspaceFrameProps) => (
  <Box className={mergeClassNames("flex min-h-0 flex-1 flex-col", className)}>
    {header}
    {navigation}
    {status === undefined
      ? null
      : (
        <Box className="border-b border-border-muted bg-surface-panel/72 px-4 py-2 backdrop-blur-sm sm:px-6 lg:px-8">
          {status}
        </Box>
      )}
    <Box className={mergeClassNames("min-h-0 flex-1", bodyClassName)}>{children}</Box>
  </Box>
)
