import { cn } from "../structure/Box.js"

export const workflowCanvasSupplementaryClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "flex min-w-0 flex-col gap-3 border-b border-border-pane px-[var(--ui-workspace-pane-padding-x)] py-3",
    className
  )

export const workflowCanvasBodyStackClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-h-full", className)
