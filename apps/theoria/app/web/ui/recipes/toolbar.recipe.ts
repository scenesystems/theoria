import { cn } from "../structure/Box.js"

export const toolbarClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "inline-flex min-w-0 items-center gap-1.5 rounded-ui-md border border-border-muted bg-surface-panel/96 px-1.5 py-1 shadow-none backdrop-blur-sm",
    className
  )
