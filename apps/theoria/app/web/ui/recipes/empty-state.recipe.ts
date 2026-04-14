import { cn } from "../structure/Box.js"

export const emptyStateClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "flex min-h-[16rem] min-w-0 flex-col items-start justify-center gap-4 border-y border-dashed border-border-strong bg-surface-canvas/82 px-6 py-8",
    className
  )

export const emptyStateIconClassName =
  "rounded-ui-md border border-border-muted bg-surface-panel p-3 text-content-muted"
