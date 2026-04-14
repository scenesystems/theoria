import type { ReactNode } from "react"

import { inspectorSectionClassName } from "../../recipes/inspector.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type InspectorSectionProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly summary?: ReactNode
  readonly title?: ReactNode
}

export const InspectorSection = ({ actions, children, className, summary, title }: InspectorSectionProps) => (
  <Box className={inspectorSectionClassName(withClassName(className))}>
    {title === undefined && summary === undefined && actions === undefined
      ? null
      : (
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
          {actions}
        </Stack>
      )}
    {children}
  </Box>
)
