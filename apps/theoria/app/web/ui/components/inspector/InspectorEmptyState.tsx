import type { ReactNode } from "react"

import { inspectorEmptyStateClassName } from "../../recipes/inspector.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { Icon, type IconSource } from "../../structure/Icon.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type InspectorEmptyStateProps = {
  readonly action?: ReactNode
  readonly className?: string
  readonly icon?: IconSource
  readonly summary: ReactNode
  readonly title: ReactNode
}

export const InspectorEmptyState = ({
  action,
  className,
  icon,
  summary,
  title
}: InspectorEmptyStateProps) => (
  <Box className={inspectorEmptyStateClassName(withClassName(className))}>
    <Stack gap="sm">
      {icon === undefined ? null : <Icon className="text-pane-meta" size="md" source={icon} />}
      {typeof title === "string" || typeof title === "number"
        ? <SemanticText role="inspector-title">{title}</SemanticText>
        : title}
      {typeof summary === "string" || typeof summary === "number"
        ? <SemanticText role="inspector-summary">{summary}</SemanticText>
        : summary}
      {action}
    </Stack>
  </Box>
)
