import { cn } from "../structure/Box.js"

export const underlineTabsListClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "flex w-full min-w-0 items-end gap-4 overflow-x-auto overscroll-x-contain border-b border-border-muted bg-transparent [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
    className
  )

export const underlineTabsTabClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border-b-2 border-transparent px-0 pb-3 pt-2 text-content-muted outline-none transition-[border-color,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus-ring/30 data-[active]:border-content-primary data-[active]:text-content-primary",
    className
  )

export const underlineTabsPanelClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-w-0 outline-none", className)
