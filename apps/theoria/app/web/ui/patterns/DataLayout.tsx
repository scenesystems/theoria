import type { ReactNode } from "react"

import type { TwoPaneRatio } from "./TwoPaneLayout.js"

import { Box, withClassName } from "../structure/Box.js"
import { TwoPaneLayout } from "./TwoPaneLayout.js"

type DataLayoutProps = {
  readonly className?: string
  readonly primary: ReactNode
  readonly ratio?: TwoPaneRatio
  readonly secondary?: ReactNode
}

export const DataLayout = ({ className, primary, ratio = "balanced", secondary }: DataLayoutProps) =>
  secondary === undefined
    ? <Box {...withClassName(className)}>{primary}</Box>
    : <TwoPaneLayout {...withClassName(className)} primary={primary} ratio={ratio} secondary={secondary} />
