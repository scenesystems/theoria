import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../structure/Box.js"

type WorkspaceNavProps = {
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

export const WorkspaceNav = ({ actions, children, className }: WorkspaceNavProps) => (
  <Box
    as="nav"
    className={mergeClassNames(
      "border-b border-stage-200/80 bg-stage-0/72 backdrop-blur-sm",
      className
    )}
  >
    <Box className="flex min-h-11 items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8 xl:px-10">
      <Box className="min-w-0 flex-1">{children}</Box>
      {actions === undefined ? null : <Box className="shrink-0">{actions}</Box>}
    </Box>
  </Box>
)
