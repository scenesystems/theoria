import { cn } from "../structure/Box.js"

export type TranscriptMode = "compact" | "expanded"
export type TranscriptTone = "default" | "accent" | "tool" | "runtime" | "quiet"
export type TranscriptAlignment = "start" | "end"

const transcriptToneClassNames: Record<TranscriptTone, string> = {
  default: "border-border-pane bg-surface-pane",
  accent: "border-border-selection bg-accent-surface/55",
  tool: "border-intent-attention-border bg-intent-attention-surface/55",
  runtime: "border-intent-danger-border bg-intent-danger-surface/45",
  quiet: "border-border-rail bg-surface-detail"
}

const transcriptCardDensityClassNames: Record<TranscriptMode, string> = {
  compact: "px-3 py-2.5",
  expanded: "px-4 py-3.5"
}

export const transcriptSurfaceClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-h-0 min-w-0 flex-col bg-surface-canvas", className)

export const transcriptTabsListClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "relative inline-flex min-w-0 items-center gap-1 border border-border-pane bg-surface-toolbar p-1",
    className
  )

export const transcriptTabsIndicatorClassName = ({ className }: { readonly className?: string }): string =>
  cn("absolute inset-y-1 border border-border-pane bg-surface-pane shadow-none", className)

export const transcriptTabsTabClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "relative z-10 inline-flex min-h-8 min-w-0 items-center justify-center px-3 py-1.5 text-pane-meta outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus-ring/30 data-[active]:text-content-primary",
    className
  )

export const transcriptTabsPanelClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-h-0 min-w-0 flex-1 outline-none", className)

export const transcriptRailClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 justify-center", className)

export const transcriptTurnClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "grid min-w-0 grid-cols-[var(--ui-workspace-transcript-rail-width)_minmax(0,1fr)] gap-4",
    className
  )

export const transcriptTurnMarkerClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col items-center gap-2", className)

export const transcriptTurnMarkerBadgeClassName = (
  { className }: { readonly className?: string }
): string =>
  cn(
    "inline-flex min-h-8 min-w-8 items-center justify-center border border-border-rail bg-surface-detail px-2 text-pane-meta",
    className
  )

export const transcriptTurnStackClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-3 border-l border-border-rail pb-1 pl-4", className)

export const transcriptRowClassName = ({
  align,
  className
}: {
  readonly align: TranscriptAlignment
  readonly className?: string
}): string => cn("flex min-w-0", align === "end" ? "justify-end" : "justify-start", className)

export const transcriptBubbleShellClassName = ({
  align,
  className
}: {
  readonly align: TranscriptAlignment
  readonly className?: string
}): string =>
  cn(
    "flex min-w-0 items-start gap-3",
    align === "end" ? "flex-row-reverse" : undefined,
    className
  )

export const transcriptMessageClassName = ({
  className,
  interactive,
  mode,
  selected,
  tone
}: {
  readonly className?: string
  readonly interactive: boolean
  readonly mode: TranscriptMode
  readonly selected: boolean
  readonly tone: TranscriptTone
}): string =>
  cn(
    "w-full max-w-[var(--ui-workspace-transcript-bubble-max-width)] border text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
    transcriptToneClassNames[tone],
    transcriptCardDensityClassNames[mode],
    interactive
      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 hover:border-border-selection hover:animate-workspace-transcript-hover"
      : undefined,
    selected ? "border-border-selection ring-1 ring-border-selection animate-workspace-selection-emphasis" : undefined,
    className
  )

export const transcriptActionClassName = ({
  className,
  interactive,
  mode,
  selected,
  tone
}: {
  readonly className?: string
  readonly interactive: boolean
  readonly mode: TranscriptMode
  readonly selected: boolean
  readonly tone: TranscriptTone
}): string =>
  cn(
    "w-full max-w-[var(--ui-workspace-transcript-bubble-max-width)] border text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
    transcriptToneClassNames[tone],
    transcriptCardDensityClassNames[mode],
    interactive
      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 hover:border-border-selection hover:animate-workspace-transcript-hover"
      : undefined,
    selected ? "border-border-selection ring-1 ring-border-selection animate-workspace-selection-emphasis" : undefined,
    className
  )

export const transcriptCardHeaderClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-1.5", className)

export const transcriptCardMetaRowClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center justify-between gap-2", className)

export const transcriptCardBodyClassName = ({ className }: { readonly className?: string }): string =>
  cn("mt-3 flex min-w-0 flex-col gap-3", className)

export const transcriptDetailBlockClassName = ({ className }: { readonly className?: string }): string =>
  cn("border border-border-rail bg-surface-detail px-4 py-3", className)

export const transcriptSelectionStateClassName = ({
  active,
  className
}: {
  readonly active: boolean
  readonly className?: string
}): string =>
  cn(
    "inline-flex min-w-0 items-center gap-2 border px-2.5 py-1",
    active
      ? "border-border-selection bg-accent-surface text-accent-solid"
      : "border-border-rail bg-surface-detail text-pane-meta",
    className
  )
