import type { PanelPadding } from "./panel.recipe.js"
import type { StatusTone } from "./status.recipe.js"

import { cn } from "../structure/Box.js"

export type SurfacePadding = PanelPadding
export type CardTone = "default" | "muted" | "accent"
export type SheetTone = CardTone
export type CalloutTone = StatusTone

const surfacePaddingClassNames: Record<SurfacePadding, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6"
}

const cardToneClassNames: Record<CardTone, string> = {
  default: "border-border-muted bg-surface-panel/96",
  muted: "border-border-muted bg-surface-canvas/92",
  accent: "border-accent-border bg-accent-surface/90"
}

const sheetToneClassNames: Record<SheetTone, string> = {
  default: "border-border-muted bg-surface-canvas/86",
  muted: "border-border-muted bg-surface-sunken/82",
  accent: "border-accent-border bg-accent-surface/82"
}

const calloutToneClassNames: Record<
  CalloutTone,
  { readonly accent: string; readonly icon: string; readonly root: string }
> = {
  neutral: {
    accent: "bg-border-strong",
    icon: "border-border-muted bg-surface-panel text-content-primary",
    root: "border-border-strong bg-surface-canvas/92 text-content-primary"
  },
  info: {
    accent: "bg-intent-info-content",
    icon: "border-intent-info-border bg-intent-info-surface text-intent-info-content",
    root: "border-intent-info-border bg-intent-info-surface text-intent-info-content"
  },
  positive: {
    accent: "bg-intent-positive-content",
    icon: "border-intent-positive-border bg-intent-positive-surface text-intent-positive-content",
    root: "border-intent-positive-border bg-intent-positive-surface text-intent-positive-content"
  },
  attention: {
    accent: "bg-intent-attention-content",
    icon: "border-intent-attention-border bg-intent-attention-surface text-intent-attention-content",
    root: "border-intent-attention-border bg-intent-attention-surface text-intent-attention-content"
  },
  danger: {
    accent: "bg-intent-danger-content",
    icon: "border-intent-danger-border bg-intent-danger-surface text-intent-danger-content",
    root: "border-intent-danger-border bg-intent-danger-surface text-intent-danger-content"
  }
}

export const cardClassName = ({
  className,
  padding,
  tone
}: {
  readonly className?: string
  readonly padding: SurfacePadding
  readonly tone: CardTone
}): string =>
  cn(
    "min-w-0 rounded-ui-xl border shadow-ui-chip transition-[background-color,border-color,color] duration-150 ease-out",
    cardToneClassNames[tone],
    surfacePaddingClassNames[padding],
    className
  )

export const sheetClassName = ({
  className,
  padding,
  tone
}: {
  readonly className?: string
  readonly padding: SurfacePadding
  readonly tone: SheetTone
}): string =>
  cn(
    "min-w-0 border-y transition-[background-color,border-color,color] duration-150 ease-out",
    sheetToneClassNames[tone],
    surfacePaddingClassNames[padding],
    className
  )

export const calloutClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: CalloutTone
}): string =>
  cn(
    "min-w-0 rounded-ui-xl border px-4 py-4 shadow-ui-chip transition-[background-color,border-color,color] duration-150 ease-out",
    calloutToneClassNames[tone].root,
    className
  )

export const calloutAccentClassName = (tone: CalloutTone): string =>
  cn("mt-0.5 h-10 w-1 shrink-0 rounded-full", calloutToneClassNames[tone].accent)

export const calloutIconClassName = (tone: CalloutTone): string =>
  cn("rounded-ui-md border p-2.5", calloutToneClassNames[tone].icon)
