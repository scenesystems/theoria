import type { ReactNode } from "react"

import {
  workspaceRailLayoutClassName,
  workspaceRailLayoutContentClassName,
  workspaceRailLayoutRailClassName,
  type WorkspaceRailLayoutWidth
} from "../../recipes/workspace-rail-layout.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"

type WorkspaceRailLayoutProps = {
  readonly className?: string
  readonly content: ReactNode
  readonly contentClassName?: string
  readonly rail: ReactNode
  readonly railClassName?: string
  readonly railSticky?: boolean
  readonly width?: WorkspaceRailLayoutWidth
}

export const WorkspaceRailLayout = ({
  className,
  content,
  contentClassName,
  rail,
  railClassName,
  railSticky = false,
  width = "md"
}: WorkspaceRailLayoutProps) => (
  <Box className={workspaceRailLayoutClassName({ width, ...withClassName(className) })}>
    <Box className={workspaceRailLayoutRailClassName({ sticky: railSticky, ...withClassName(railClassName) })}>
      {rail}
    </Box>
    <Box className={workspaceRailLayoutContentClassName(withClassName(contentClassName))}>{content}</Box>
  </Box>
)
