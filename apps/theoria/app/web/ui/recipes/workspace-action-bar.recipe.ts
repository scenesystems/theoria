import { cn } from "../structure/Box.js"

export const workspaceActionBarClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "flex min-h-[var(--ui-workspace-action-bar-height)] min-w-0 items-center justify-between gap-3 border-b border-border-pane bg-surface-toolbar px-[var(--ui-workspace-pane-padding-x)] py-2",
    className
  )

export const workspaceActionBarGroupClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center gap-2", className)
