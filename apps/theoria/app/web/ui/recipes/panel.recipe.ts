import { cn } from "../structure/Box.js"

export type PanelTone = "default" | "muted" | "accent"
export type PanelPadding = "sm" | "md" | "lg"

const panelToneClassNames: Record<PanelTone, string> = {
  default: "border-border-muted bg-surface-panel/88 backdrop-blur-sm",
  muted: "border-border-muted bg-surface-canvas/82 backdrop-blur-sm",
  accent: "border-accent-border bg-accent-surface/96 backdrop-blur-sm"
}

const panelPaddingClassNames: Record<PanelPadding, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6"
}

export const panelClassName = ({
  className,
  padding,
  tone
}: {
  readonly className?: string
  readonly padding: PanelPadding
  readonly tone: PanelTone
}): string => cn("min-w-0 border-y shadow-none", panelToneClassNames[tone], panelPaddingClassNames[padding], className)
