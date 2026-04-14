import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../structure/Box.js"

export type TwoPaneRatio = "balanced" | "workspace" | "inspector"

const ratioClassNames: Record<TwoPaneRatio, string> = {
  balanced: "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
  workspace: "grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]",
  inspector: "grid-cols-1 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,0.28fr)]"
}

type TwoPaneLayoutProps = {
  readonly className?: string
  readonly divider?: boolean
  readonly primary: ReactNode
  readonly ratio?: TwoPaneRatio
  readonly secondary: ReactNode
}

export const TwoPaneLayout = ({
  className,
  divider = true,
  primary,
  ratio = "workspace",
  secondary
}: TwoPaneLayoutProps) => (
  <Box
    className={mergeClassNames(
      "grid min-w-0 items-stretch gap-0",
      ratioClassNames[ratio],
      divider ? "xl:divide-x xl:divide-border-muted" : undefined,
      className
    )}
  >
    <Box className="min-w-0">{primary}</Box>
    <Box className="min-w-0">{secondary}</Box>
  </Box>
)
