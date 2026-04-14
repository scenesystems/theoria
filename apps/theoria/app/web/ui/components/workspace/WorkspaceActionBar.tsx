import type { ReactNode } from "react"

import {
  workspaceActionBarClassName,
  workspaceActionBarGroupClassName
} from "../../recipes/workspace-action-bar.recipe.js"
import { Box, type BoxProps, withClassName } from "../../structure/Box.js"

export type WorkspaceActionBarProps = BoxProps & {
  readonly leading?: ReactNode
  readonly trailing?: ReactNode
}

export const WorkspaceActionBar = ({
  children,
  className,
  leading,
  trailing,
  ...props
}: WorkspaceActionBarProps) => (
  <Box {...props} className={workspaceActionBarClassName(withClassName(className))}>
    {children === undefined
      ? (
        <>
          <Box className={workspaceActionBarGroupClassName({})}>{leading}</Box>
          <Box className={workspaceActionBarGroupClassName({ className: "justify-end" })}>{trailing}</Box>
        </>
      )
      : children}
  </Box>
)
