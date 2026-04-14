import { cn } from "../structure/Box.js"

export const workflowPanelBodyClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-4", className)

export const workflowPanelSectionClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-3 border-b border-border-rail pb-4 last:border-b-0 last:pb-0", className)

export const workflowPanelSectionHeaderClassName = ({ className }: { readonly className?: string }): string =>
  cn("grid min-w-0 gap-3 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-4", className)

export const workflowPanelSectionCopyClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-1.5", className)

export const workflowPanelSectionControlsClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-start gap-2", className)

export const workflowPanelHighlightClassName = ({ className }: { readonly className?: string }): string =>
  cn("border border-border-rail bg-surface-detail px-4 py-3", className)
