import { Button } from "@base-ui-components/react/button"
import { Match } from "effect"
import type { ReactNode } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"

import { InternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"

const actionControlClassName = (variant: SurfaceVariant): string =>
  Match.value(variant).pipe(
    Match.when(
      "expanded",
      () =>
        "inline-flex min-h-8 max-w-full items-center justify-center rounded-lg border px-3.5 py-1.5 text-ink-800 transition-colors duration-150 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    ),
    Match.orElse(
      () =>
        "inline-flex min-h-9 max-w-full items-center justify-center rounded-lg border px-3.5 py-2 text-ink-800 transition-colors duration-150 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    )
  )

export const ActionButton = ({
  className,
  disabled,
  icon,
  label,
  onClick,
  variant
}: {
  readonly className: string
  readonly disabled: boolean
  readonly icon?: ReactNode
  readonly label: string
  readonly onClick: () => void
  readonly variant: SurfaceVariant
}) => (
  <Button
    className={`${actionControlClassName(variant)} gap-1.5 ${className}`}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {icon !== undefined ? icon : null}
    <SemanticText
      as="span"
      className="max-w-full whitespace-nowrap"
      role="button-label"
      text={label}
      variant={variant}
    />
  </Button>
)

export const ActionLink = ({
  className,
  href,
  label,
  variant
}: {
  readonly className: string
  readonly href: string
  readonly label: string
  readonly variant: SurfaceVariant
}) => (
  <InternalLink className={`${actionControlClassName(variant)} ${className}`} href={href}>
    <SemanticText
      as="span"
      className="max-w-full whitespace-nowrap"
      role="button-label"
      text={label}
      variant={variant}
    />
  </InternalLink>
)
