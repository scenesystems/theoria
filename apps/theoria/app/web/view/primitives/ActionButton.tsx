import { Button } from "@base-ui/react/button"
import type { ReactNode } from "react"

import { SemanticText } from "./SemanticText.js"

/** The one filled action on a surface: ink on the canvas, whether it is a button or a link. */
export const primaryActionClassName =
  "inline-flex min-h-10 items-center gap-2 rounded-control bg-ink-900 px-5 py-2.5 text-stage-0 transition-colors duration-150 ease-out hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-2 focus-visible:ring-offset-stage-50 disabled:cursor-not-allowed disabled:opacity-60"

/** An action said in words beside the filled one: ink that darkens under the pointer. */
export const textActionClassName =
  "inline-flex min-h-10 items-center gap-1.5 rounded-control px-2 py-2.5 text-ink-700 transition-colors duration-150 ease-out hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-2 focus-visible:ring-offset-stage-50"

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
    <SemanticText as="span" className="text-stage-0" role="button-label" text={label} variant="expanded" />
  </Button>
)
