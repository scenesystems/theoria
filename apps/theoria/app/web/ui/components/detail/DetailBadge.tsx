import type { ReactNode } from "react"

import { detailBadgeClassName, type DetailBadgeTone } from "../../recipes/detail-list.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

type DetailBadgeProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly tone?: DetailBadgeTone
}

export const DetailBadge = ({ children, className, tone = "neutral" }: DetailBadgeProps) => (
  <Box as="span" className={detailBadgeClassName({ tone, ...withClassName(className) })}>
    <SemanticText role="detail-label" tone="inherit">
      {children}
    </SemanticText>
  </Box>
)
