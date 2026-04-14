import type { ReactNode } from "react"

import { inspectorSummaryBlockClassName } from "../../recipes/inspector.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type InspectorSummaryBlockProps = {
  readonly children?: ReactNode
  readonly className?: string
  readonly meta?: ReactNode
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

export const InspectorSummaryBlock = ({
  children,
  className,
  meta,
  summary,
  title
}: InspectorSummaryBlockProps) => (
  <Box className={inspectorSummaryBlockClassName(withClassName(className))}>
    <Stack gap="sm">
      {title === undefined
        ? null
        : typeof title === "string" || typeof title === "number"
        ? <SemanticText role="inspector-title">{title}</SemanticText>
        : title}
      {summary === undefined
        ? null
        : typeof summary === "string" || typeof summary === "number"
        ? <SemanticText role="inspector-summary">{summary}</SemanticText>
        : summary}
      {meta}
      {children}
    </Stack>
  </Box>
)
