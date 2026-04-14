import type { ReactNode } from "react"

import { statusDotClassName, statusPillClassName, type StatusTone } from "../../recipes/status.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

type StatusPillProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly tone?: StatusTone
}

export const StatusPill = ({ children, className, tone = "neutral" }: StatusPillProps) => (
  <Box as="span" className={statusPillClassName({ tone, ...withClassName(className) })}>
    <Box as="span" className={["size-2 rounded-full", statusDotClassName(tone)].join(" ")} />
    <SemanticText role="status" tone="inherit">
      {children}
    </SemanticText>
  </Box>
)
