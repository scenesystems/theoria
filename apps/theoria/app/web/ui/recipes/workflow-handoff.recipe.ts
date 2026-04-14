import { cn } from "../structure/Box.js"

export const workflowHandoffSummaryListClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-stretch gap-3", className)

export const workflowHandoffSummaryCardClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-1 basis-72 flex-col gap-2 border border-border-rail bg-surface-detail px-4 py-3", className)

export const workflowHandoffSummaryMetaClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center gap-2", className)
