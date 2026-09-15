import { Button } from "@base-ui/react/button"
import type { ReactNode } from "react"

import { focusEdgeClassName } from "./designSystem.js"
import { SemanticText } from "./SemanticText.js"

/** The one filled action on a surface: ink on the canvas, whether it is a button or a link. */
export const primaryActionClassName =
  `inline-flex min-h-10 items-center gap-2 rounded-control bg-emphasis px-5 py-2.5 text-on-emphasis transition-colors duration-150 ease-out hover:bg-emphasis-hover ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60`

/** An action said in words beside the filled one: ink that darkens under the pointer. */
export const textActionClassName =
  `inline-flex min-h-10 items-center gap-1.5 rounded-control px-2 py-2.5 text-ink-secondary transition-colors duration-150 ease-out hover:text-ink-strong ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`

export const ActionButton = ({
  disabled,
  icon,
  label,
  onClick
}: {
  readonly disabled?: boolean
  readonly icon?: ReactNode
  readonly label: string
  readonly onClick: () => void
}) => (
  <Button className={primaryActionClassName} disabled={disabled === true} onClick={onClick} type="button">
    {icon}
    <SemanticText as="span" className="text-on-emphasis" role="button-label" text={label} variant="expanded" />
  </Button>
)
