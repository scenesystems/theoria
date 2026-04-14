import { cn } from "../structure/Box.js"

export const inspectorSurfaceClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-h-0 min-w-0 flex-col bg-surface-inspector", className)

export const inspectorTabsListClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "relative inline-flex min-w-0 items-center gap-1 border border-border-pane bg-surface-toolbar p-1",
    className
  )

export const inspectorTabsIndicatorClassName = ({ className }: { readonly className?: string }): string =>
  cn("absolute inset-y-1 border border-border-pane bg-surface-pane shadow-none", className)

export const inspectorTabsTabClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "relative z-10 inline-flex min-h-8 min-w-0 items-center justify-center px-3 py-1.5 text-pane-meta outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus-ring/30 data-[active]:text-content-primary",
    className
  )

export const inspectorTabsPanelClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-h-0 min-w-0 flex-1 animate-workspace-inspector-switch outline-none", className)

export const inspectorSectionClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "flex min-w-0 flex-col gap-3 border-b border-border-rail px-[var(--ui-workspace-pane-padding-x)] py-[var(--ui-workspace-pane-padding-y)]",
    className
  )

export const inspectorSummaryBlockClassName = ({ className }: { readonly className?: string }): string =>
  cn("border border-border-rail bg-surface-detail px-4 py-3", className)

export const inspectorEmptyStateClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "flex min-w-0 flex-col gap-3 border border-dashed border-border-rail bg-surface-detail/80 px-4 py-5",
    className
  )
