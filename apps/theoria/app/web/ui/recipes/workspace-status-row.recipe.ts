import { cn } from "../structure/Box.js"

export const workspaceStatusRowClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center gap-2.5", className)

export const workspaceStatusItemShellClassName = ({ className }: { readonly className?: string }): string =>
  cn("inline-flex min-w-0 items-center", className)

export const workspaceStatusItemClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "inline-flex min-w-0 items-center gap-2 border border-border-rail bg-surface-detail px-2.5 py-1",
    className
  )
