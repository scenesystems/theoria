import type { ReactNode } from "react"

import type { Tone } from "./designSystem.js"
import { Stack } from "./Layout.js"

/**
 * Left-accent border with tone color. Used for callout blocks, example
 * rows, and any content that needs a colored left edge for visual hierarchy.
 *
 * Renders a Stack with a 2px left border in the tone's accent color and
 * consistent left padding.
 *
 * @since 0.1.0
 */
export const AccentBorder = ({
  children,
  className,
  tone
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly tone: Tone
}) => (
  <Stack className={`border-l-2 pl-3 ${tone.border} ${className ?? "gap-1"}`}>
    {children}
  </Stack>
)
