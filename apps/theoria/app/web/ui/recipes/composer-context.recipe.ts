import { cn } from "../structure/Box.js"

export const traceAwareAgentComposerClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-4", className)

export const traceAwareAgentContextClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-2 border border-border-rail bg-surface-detail px-4 py-3", className)

export const traceAwareAgentSummaryListClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center gap-2", className)

export const traceAwareAgentPromptClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-h-0 min-w-0", className)
