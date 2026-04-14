import type { ReactNode } from "react"

import { badgeClassName, type BadgeTone } from "../../recipes/badge.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

type BadgeProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly tone?: BadgeTone
}

export const Badge = ({ children, className, tone = "neutral" }: BadgeProps) => (
  <Box as="span" className={badgeClassName({ tone, ...withClassName(className) })}>
    <SemanticText role="badge" tone="inherit">
      {children}
    </SemanticText>
  </Box>
)
