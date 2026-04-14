import type { ReactNode } from "react"

import {
  workspaceSplitClassName,
  workspaceSplitDividerClassName,
  workspaceSplitPrimaryClassName,
  workspaceSplitSecondaryClassName
} from "../../recipes/workspace-split.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"

type WorkspaceSplitLayoutProps = {
  readonly className?: string
  readonly primary: ReactNode
  readonly secondary: ReactNode
}

export const WorkspaceSplitLayout = ({ className, primary, secondary }: WorkspaceSplitLayoutProps) => (
  <Box className={workspaceSplitClassName(withClassName(className))}>
    <Box className={workspaceSplitPrimaryClassName({})}>{primary}</Box>
    <Box aria-hidden className={workspaceSplitDividerClassName({})} />
    <Box className={workspaceSplitSecondaryClassName({})}>{secondary}</Box>
  </Box>
)
