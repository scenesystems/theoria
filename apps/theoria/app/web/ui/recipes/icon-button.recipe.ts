import { cn } from "../structure/Box.js"

export type IconButtonTone = "primary" | "neutral" | "ghost"
export type IconButtonSize = "sm" | "md" | "lg"

const iconButtonToneClassNames: Record<IconButtonTone, string> = {
  primary:
    "border-content-primary bg-content-primary text-content-inverse hover:border-content-secondary hover:bg-content-secondary shadow-ui-chip",
  neutral:
    "border-border-strong bg-surface-panel text-content-primary hover:border-content-subtle hover:bg-surface-canvas",
  ghost: "border-transparent bg-transparent text-content-secondary hover:border-border-muted hover:bg-surface-sunken"
}

const iconButtonSizeClassNames: Record<IconButtonSize, string> = {
  sm: "size-9",
  md: "size-10",
  lg: "size-12"
}

export const iconButtonClassName = ({
  className,
  size,
  tone
}: {
  readonly className?: string
  readonly size: IconButtonSize
  readonly tone: IconButtonTone
}): string =>
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-ui-md border transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 data-[pressed]:translate-y-px",
    iconButtonToneClassNames[tone],
    iconButtonSizeClassNames[size],
    className
  )
