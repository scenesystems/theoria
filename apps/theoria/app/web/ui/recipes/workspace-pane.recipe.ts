import { cn } from "../structure/Box.js"

export type WorkspacePaneVariant = "canvas" | "support" | "inspector" | "strip"
export type WorkspacePaneDensity = "default" | "compact"

const workspacePaneVariantClassNames: Record<WorkspacePaneVariant, string> = {
  canvas: "border-border-pane bg-surface-canvas",
  support: "border-border-pane bg-surface-pane",
  inspector: "border-border-pane bg-surface-inspector",
  strip: "border-border-pane bg-surface-strip"
}

const workspacePaneHeaderPaddingClassNames: Record<WorkspacePaneVariant, string> = {
  canvas: "px-[var(--ui-workspace-pane-padding-x)] py-3",
  support: "px-[var(--ui-workspace-pane-padding-x)] py-3",
  inspector: "px-[var(--ui-workspace-pane-padding-x)] py-3",
  strip: "px-[var(--ui-workspace-compact-strip-padding-x)] py-[var(--ui-workspace-compact-strip-padding-y)]"
}

const workspacePaneBodyPaddingClassNames: Record<WorkspacePaneDensity, string> = {
  default: "px-[var(--ui-workspace-pane-padding-x)] py-[var(--ui-workspace-pane-padding-y)]",
  compact: "px-[var(--ui-workspace-pane-padding-x)] py-3"
}

export const workspacePaneClassName = ({
  className,
  variant
}: {
  readonly className?: string
  readonly variant: WorkspacePaneVariant
}): string => cn("flex min-h-0 min-w-0 flex-col border shadow-none", workspacePaneVariantClassNames[variant], className)

export const workspacePaneHeaderClassName = ({
  className,
  variant
}: {
  readonly className?: string
  readonly variant: WorkspacePaneVariant
}): string =>
  cn(
    "flex min-w-0 items-start justify-between gap-4 border-b border-border-pane",
    workspacePaneHeaderPaddingClassNames[variant],
    className
  )

export const workspacePaneBodyClassName = ({
  className,
  density,
  padded
}: {
  readonly className?: string
  readonly density: WorkspacePaneDensity
  readonly padded: boolean
}): string =>
  cn(
    "min-h-0 min-w-0 flex-1",
    padded ? workspacePaneBodyPaddingClassNames[density] : undefined,
    className
  )

export const workspacePaneFooterClassName = ({
  className,
  variant
}: {
  readonly className?: string
  readonly variant: WorkspacePaneVariant
}): string =>
  cn(
    "min-w-0 border-t border-border-pane",
    workspacePaneHeaderPaddingClassNames[variant],
    className
  )

export const workspacePaneTitleGroupClassName = "flex min-w-0 flex-1 flex-col gap-1.5"
export const workspacePaneActionRailClassName = "flex shrink-0 items-start gap-2"
