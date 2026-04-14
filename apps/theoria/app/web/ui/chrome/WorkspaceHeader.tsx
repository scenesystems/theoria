import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../structure/Box.js"
import { Cluster } from "../structure/Cluster.js"
import { SemanticText } from "../structure/SemanticText.js"

type WorkspaceHeaderProps = {
  readonly actions?: ReactNode
  readonly brand?: ReactNode
  readonly center?: ReactNode
  readonly className?: string
  readonly start?: ReactNode
  readonly title: ReactNode
}

const renderTitle = (title: ReactNode): ReactNode =>
  typeof title === "string"
    ? <SemanticText className="truncate" role="display-sm">{title}</SemanticText>
    : title

export const WorkspaceHeader = ({ actions, brand, center, className, start, title }: WorkspaceHeaderProps) => (
  <Box
    as="header"
    className={mergeClassNames(
      "relative z-20 border-b border-stage-200/90 bg-stage-0/88 backdrop-blur-xl",
      className
    )}
  >
    <Box className="grid min-h-[4.25rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
      <Box className="min-w-0 justify-self-start">
        <Cluster className="min-w-0 flex-nowrap" gap="sm">
          {start}
          {brand}
          {brand === undefined ? null : <Box aria-hidden className="hidden h-6 w-px bg-border-muted sm:block" />}
          <Box className="min-w-0 flex-1">{renderTitle(title)}</Box>
        </Cluster>
      </Box>
      <Box className="min-w-0 justify-self-center">{center}</Box>
      <Box className="min-w-0 justify-self-end">{actions}</Box>
    </Box>
  </Box>
)
