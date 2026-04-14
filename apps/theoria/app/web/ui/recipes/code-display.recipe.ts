import { cn } from "../structure/Box.js"

export const codeBlockClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-w-0 overflow-hidden rounded-ui-xl border border-border-muted bg-surface-canvas/92 shadow-ui-chip", className)

export const codeBlockHeaderClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3", className)

export const codeBlockBodyClassName = ({
  className,
  hasHeader,
  wrap
}: {
  readonly className?: string
  readonly hasHeader: boolean
  readonly wrap: boolean
}): string =>
  cn(
    "min-w-0 bg-surface-panel/72 px-4 py-3",
    hasHeader ? "border-t border-border-muted/80" : undefined,
    wrap ? "overflow-x-hidden" : "overflow-x-auto",
    className
  )

export const codeBlockCodeClassName = ({
  className,
  wrap
}: {
  readonly className?: string
  readonly wrap: boolean
}): string =>
  cn(
    "block min-w-full font-mono text-[0.95rem] leading-6 text-content-primary [tab-size:2]",
    wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
    className
  )
