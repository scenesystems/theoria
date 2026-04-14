import { cn } from "../structure/Box.js"

export const workspaceStripClassName = ({ className }: { readonly className?: string }): string =>
  cn("animate-workspace-pane-reveal", className)

export const workspaceStripBodyClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center gap-3", className)

export const workspaceStripSummaryClassName = ({ className }: { readonly className?: string }): string =>
  cn("max-w-[46rem]", className)

export const workspaceStripActionsClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center justify-end gap-2", className)
