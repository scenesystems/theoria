import type { ReactNode } from "react"

import { type DetailBadgeTone, evidenceCalloutClassName } from "../../recipes/detail-list.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type EvidenceCalloutProps = {
  readonly action?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly summary?: ReactNode
  readonly title: ReactNode
  readonly tone?: DetailBadgeTone
}

export const EvidenceCallout = ({
  action,
  children,
  className,
  summary,
  title,
  tone = "neutral"
}: EvidenceCalloutProps) => (
  <Box className={evidenceCalloutClassName({ tone, ...withClassName(className) })}>
    <Stack gap="sm">
      {typeof title === "string" || typeof title === "number"
        ? <SemanticText role="pane-title">{title}</SemanticText>
        : title}
      {summary === undefined
        ? null
        : typeof summary === "string" || typeof summary === "number"
        ? <SemanticText role="pane-summary">{summary}</SemanticText>
        : summary}
      {children}
      {action}
    </Stack>
  </Box>
)
