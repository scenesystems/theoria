import type { ReactNode } from "react"

import { emptyStateClassName, emptyStateIconClassName } from "../../recipes/empty-state.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { Icon, type IconSource } from "../../structure/Icon.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type EmptyStateProps = {
  readonly action?: ReactNode
  readonly className?: string
  readonly description: ReactNode
  readonly eyebrow?: ReactNode
  readonly icon?: IconSource
  readonly title: ReactNode
}

export const EmptyState = ({ action, className, description, eyebrow, icon, title }: EmptyStateProps) => (
  <Stack {...withClassName(emptyStateClassName({ ...(className === undefined ? {} : { className }) }))} gap="md">
    {icon === undefined ? null : (
      <Box as="span" className={emptyStateIconClassName}>
        <Icon size="lg" source={icon} />
      </Box>
    )}
    <Stack gap="sm">
      {eyebrow === undefined ? null : <SemanticText role="eyebrow">{eyebrow}</SemanticText>}
      <SemanticText role="display">{title}</SemanticText>
      <SemanticText role="body-sm">{description}</SemanticText>
    </Stack>
    {action}
  </Stack>
)
