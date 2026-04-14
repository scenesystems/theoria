import type { ReactNode } from "react"

import {
  workspacePaneActionRailClassName,
  workspacePaneBodyClassName,
  workspacePaneClassName,
  type WorkspacePaneDensity,
  workspacePaneFooterClassName,
  workspacePaneHeaderClassName,
  workspacePaneTitleGroupClassName,
  type WorkspacePaneVariant
} from "../../recipes/workspace-pane.recipe.js"
import { Box, type BoxProps, withClassName } from "../../structure/Box.js"
import { ScrollRegion, type ScrollRegionProps } from "../../structure/ScrollRegion.js"
import { type SemanticRole, SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

const semanticNode = (value: ReactNode, role: SemanticRole): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role={role}>{value}</SemanticText>
    : value

const paneLabelRole = (variant: WorkspacePaneVariant): SemanticRole => variant === "strip" ? "strip-label" : "pane-meta"
const paneSummaryRole = (variant: WorkspacePaneVariant): SemanticRole =>
  variant === "inspector" ? "inspector-summary" : "pane-summary"
const paneTitleRole = (variant: WorkspacePaneVariant): SemanticRole =>
  variant === "inspector" ? "inspector-title" : "pane-title"

export type WorkspacePaneProps = BoxProps & {
  readonly variant?: WorkspacePaneVariant
}

export const WorkspacePane = ({ className, variant = "support", ...props }: WorkspacePaneProps) => (
  <Box {...props} className={workspacePaneClassName({ variant, ...withClassName(className) })} />
)

export type WorkspacePaneHeaderProps = {
  readonly actions?: ReactNode
  readonly className?: string
  readonly label?: ReactNode
  readonly meta?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
  readonly variant?: WorkspacePaneVariant
}

export const WorkspacePaneHeader = ({
  actions,
  className,
  label,
  meta,
  summary,
  title,
  variant = "support"
}: WorkspacePaneHeaderProps) => (
  <Box className={workspacePaneHeaderClassName({ variant, ...withClassName(className) })}>
    <Stack className={workspacePaneTitleGroupClassName} gap="sm">
      {label === undefined ? null : semanticNode(label, paneLabelRole(variant))}
      {title === undefined ? null : semanticNode(title, paneTitleRole(variant))}
      {summary === undefined ? null : semanticNode(summary, paneSummaryRole(variant))}
      {meta}
    </Stack>
    {actions === undefined ? null : <Box className={workspacePaneActionRailClassName}>{actions}</Box>}
  </Box>
)

export type WorkspacePaneBodyProps = Omit<BoxProps, "children"> & {
  readonly children?: ReactNode
  readonly density?: WorkspacePaneDensity
  readonly direction?: ScrollRegionProps["direction"]
  readonly padded?: boolean
  readonly scroll?: boolean
}

export const WorkspacePaneBody = ({
  children,
  className,
  density = "default",
  direction = "vertical",
  padded = true,
  scroll = false,
  ...props
}: WorkspacePaneBodyProps) =>
  scroll
    ? (
      <ScrollRegion
        {...props}
        className={workspacePaneBodyClassName({ density, padded, ...withClassName(className) })}
        direction={direction}
      >
        {children}
      </ScrollRegion>
    )
    : (
      <Box {...props} className={workspacePaneBodyClassName({ density, padded, ...withClassName(className) })}>
        {children}
      </Box>
    )

export type WorkspacePaneFooterProps = BoxProps & {
  readonly variant?: WorkspacePaneVariant
}

export const WorkspacePaneFooter = ({ className, variant = "support", ...props }: WorkspacePaneFooterProps) => (
  <Box {...props} className={workspacePaneFooterClassName({ variant, ...withClassName(className) })} />
)
