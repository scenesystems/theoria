import type { ReactNode } from "react"

import {
  calloutAccentClassName,
  calloutClassName,
  calloutIconClassName,
  type CalloutTone
} from "../../recipes/surface.recipe.js"
import { Box } from "../../structure/Box.js"
import { Icon, type IconSource } from "../../structure/Icon.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type CalloutProps = {
  readonly action?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly description?: ReactNode
  readonly icon?: IconSource
  readonly title: ReactNode
  readonly tone?: CalloutTone
}

const calloutTitleContent = (title: ReactNode): ReactNode =>
  typeof title === "string" || typeof title === "number"
    ? <SemanticText role="display-sm" tone="inherit">{title}</SemanticText>
    : title

const calloutDescriptionContent = (description: ReactNode): ReactNode =>
  typeof description === "string" || typeof description === "number"
    ? <SemanticText role="body-sm" tone="inherit">{description}</SemanticText>
    : description

export const Callout = ({
  action,
  children,
  className,
  description,
  icon,
  title,
  tone = "neutral"
}: CalloutProps) => (
  <Box className={calloutClassName({ tone, ...(className === undefined ? {} : { className }) })}>
    <Box className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <Box className="flex min-w-0 flex-1 gap-3">
        <Box as="span" className={calloutAccentClassName(tone)} />
        {icon === undefined ? null : (
          <Box as="span" className={calloutIconClassName(tone)}>
            <Icon className="text-inherit" size="md" source={icon} />
          </Box>
        )}
        <Stack className="flex-1" gap="sm">
          {calloutTitleContent(title)}
          {description === undefined ? null : calloutDescriptionContent(description)}
          {children === undefined ? null : <Box>{children}</Box>}
        </Stack>
      </Box>
      {action === undefined ? null : <Box className="shrink-0">{action}</Box>}
    </Box>
  </Box>
)
