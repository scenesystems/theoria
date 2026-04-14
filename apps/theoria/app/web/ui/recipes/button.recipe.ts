import { cn } from "../structure/Box.js"

export type ButtonTone = "primary" | "neutral" | "danger" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"

const buttonToneClassNames: Record<ButtonTone, string> = {
  primary:
    "border-content-primary bg-content-primary text-content-inverse hover:border-content-secondary hover:bg-content-secondary shadow-ui-chip",
  neutral:
    "border-border-strong bg-surface-panel text-content-primary hover:border-content-subtle hover:bg-surface-canvas shadow-ui-chip",
  danger:
    "border-intent-danger-content bg-intent-danger-content text-content-inverse hover:border-danger-700 hover:bg-danger-700 shadow-ui-chip",
  ghost: "border-transparent bg-transparent text-content-secondary hover:border-border-muted hover:bg-surface-sunken"
}

const buttonSizeClassNames: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-2",
  md: "min-h-10 px-4 py-2.5",
  lg: "min-h-12 px-5 py-3"
}

export const buttonBaseClassName =
  "inline-flex min-w-0 items-center justify-center rounded-ui-md border transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 data-[pressed]:translate-y-px"

export const buttonClassName = ({
  className,
  fullWidth,
  size,
  tone
}: {
  readonly className?: string
  readonly fullWidth?: boolean
  readonly size: ButtonSize
  readonly tone: ButtonTone
}): string =>
  cn(
    buttonBaseClassName,
    buttonToneClassNames[tone],
    buttonSizeClassNames[size],
    fullWidth === true ? "w-full" : undefined,
    className
  )
