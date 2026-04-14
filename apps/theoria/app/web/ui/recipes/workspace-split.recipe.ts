import { cn } from "../structure/Box.js"

export const workspaceSplitClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "grid min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)_var(--ui-workspace-pane-divider-thickness)_auto] bg-surface-workspace lg:grid-cols-[minmax(0,1fr)_var(--ui-workspace-pane-divider-thickness)_var(--ui-workspace-inspector-width)] lg:grid-rows-1",
    className
  )

export const workspaceSplitPrimaryClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-h-0 min-w-0", className)

export const workspaceSplitSecondaryClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-h-0 min-w-0", className)

export const workspaceSplitDividerClassName = ({ className }: { readonly className?: string }): string =>
  cn("bg-border-pane", className)
