import type { ReactNode } from "react"

import {
  workspaceStatusItemClassName,
  workspaceStatusItemShellClassName,
  workspaceStatusRowClassName
} from "../../recipes/workspace-status-row.recipe.js"
import { Box, type BoxProps } from "../../structure/Box.js"
import { Inline } from "../../structure/Inline.js"
import { SemanticText } from "../../structure/SemanticText.js"

const statusNode = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? (
      <Box as="span" className={workspaceStatusItemClassName({})}>
        <SemanticText role="pane-meta" tone="inherit">
          {value}
        </SemanticText>
      </Box>
    )
    : value

export type WorkspaceStatusRowProps = BoxProps & {
  readonly items?: ReadonlyArray<ReactNode>
}

export const WorkspaceStatusRow = ({ children, className, items, ...props }: WorkspaceStatusRowProps) => (
  <Box {...props} className={workspaceStatusRowClassName(className === undefined ? {} : { className })}>
    {items === undefined
      ? children
      : (
        <Inline gap="sm" wrap>
          {items.map((item, index) => (
            <Box className={workspaceStatusItemShellClassName({})} key={String(index)}>
              {statusNode(item)}
            </Box>
          ))}
        </Inline>
      )}
  </Box>
)
