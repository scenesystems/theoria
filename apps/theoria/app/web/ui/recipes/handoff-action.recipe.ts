import { cn } from "../structure/Box.js"

export const workflowHandoffActionClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-3 border border-border-pane bg-surface-pane p-4", className)

export const workflowHandoffActionSummaryClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-1", className)
