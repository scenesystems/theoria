import { Button } from "@base-ui-components/react/button"
import type { ReactNode } from "react"

import { SemanticText } from "./SemanticText.js"

const primaryCta =
  "inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink-900/90 bg-ink-900 px-5 py-2.5 text-stage-0 shadow-chip transition-all duration-150 ease-out hover:border-ink-800 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"

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
  <Button className={primaryCta} disabled={disabled === true} onClick={onClick} type="button">
    {icon !== undefined ? icon : null}
    <SemanticText as="span" className="text-stage-0" role="button-label" text={label} variant="expanded" />
  </Button>
)
