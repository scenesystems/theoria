import { cn } from "../structure/Box.js"

export const interactionToolbarClassName = ({ className }: { readonly className?: string }): string =>
  cn("border-b border-border-pane bg-surface-toolbar", className)

export const interactionToolbarContextClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-1", className)

export const interactionToolbarSummaryClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center gap-2", className)

export const interactionToolbarActionsClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center justify-end gap-2", className)
