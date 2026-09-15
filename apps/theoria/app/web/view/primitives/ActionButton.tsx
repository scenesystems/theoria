import { Button } from "@base-ui/react/button"
import { Option } from "effect"
import type { ReactNode } from "react"

import { focusClassName, primaryActionClassName, respondColorsClassName } from "./designSystem.js"
import { SemanticText } from "./SemanticText.js"

/** The one filled action on a surface: the primary action's paint at a hero's size, whether it is a button or a link. */
export const filledActionClassName =
  `inline-flex min-h-10 items-center gap-2 rounded-control border px-5 py-2.5 ${respondColorsClassName} ${focusClassName} focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 ${primaryActionClassName}`

/** An action said in words beside the filled one: ink that darkens under the pointer. */
export const textActionClassName =
  `inline-flex min-h-10 items-center gap-1.5 rounded-control px-2 py-2.5 text-ink-secondary ${respondColorsClassName} hover:text-ink-strong ${focusClassName} focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`

export const ActionButton = ({
  disabled,
  icon,
  label,
  onClick
}: {
  readonly disabled: boolean
  readonly icon: Option.Option<ReactNode>
  readonly label: string
  readonly onClick: () => void
}) => (
  <Button className={filledActionClassName} disabled={disabled} onClick={onClick} type="button">
    {Option.match(icon, { onNone: () => null, onSome: (glyph) => glyph })}
    <SemanticText as="span" className="text-on-emphasis" role="button-label" text={label} variant="expanded" />
  </Button>
)
