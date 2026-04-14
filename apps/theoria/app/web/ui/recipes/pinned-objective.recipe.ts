import { cn } from "../structure/Box.js"

export const pinnedObjectivePanelClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-4", className)

export const pinnedObjectiveListClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-3", className)

export const pinnedObjectiveCardClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-3 border border-border-pane bg-surface-pane p-4", className)

export const pinnedObjectiveHeaderClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center justify-between gap-2", className)

export const pinnedObjectiveContextClassName = ({ className }: { readonly className?: string }): string =>
  cn("border border-border-rail bg-surface-detail px-3 py-2", className)
