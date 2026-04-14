import type { ReactNode } from "react"

import { withClassName } from "../../structure/Box.js"
import { Cluster } from "../../structure/Cluster.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type SectionHeaderProps = {
  readonly actions?: ReactNode
  readonly className?: string
  readonly description?: ReactNode
  readonly eyebrow?: ReactNode
  readonly meta?: ReactNode
  readonly title: ReactNode
}

export const SectionHeader = ({ actions, className, description, eyebrow, meta, title }: SectionHeaderProps) => (
  <Cluster {...withClassName(className)} gap="md" justify="between">
    <Stack className="flex-1" gap="sm">
      {eyebrow === undefined ? null : <SemanticText role="eyebrow">{eyebrow}</SemanticText>}
      <SemanticText role="display-sm">{title}</SemanticText>
      {description === undefined ? null : <SemanticText role="body-sm">{description}</SemanticText>}
      {meta === undefined ? null : meta}
    </Stack>
    {actions}
  </Cluster>
)
