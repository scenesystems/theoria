import { cn } from "../structure/Box.js"

export const segmentedControlListClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "relative inline-flex min-w-0 items-center gap-1 rounded-ui-md border border-border-muted bg-surface-sunken/90 p-1 shadow-none backdrop-blur-sm",
    className
  )

export const segmentedControlIndicatorClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "absolute inset-y-1 rounded-ui-sm border border-border-subtle bg-surface-panel/96 shadow-none transition-all duration-200 ease-out",
    className
  )

export const segmentedControlSegmentClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "relative z-10 inline-flex min-h-8 min-w-0 items-center justify-center rounded-ui-sm px-3 py-1.5 text-content-muted transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 data-[active]:text-content-primary",
    className
  )
