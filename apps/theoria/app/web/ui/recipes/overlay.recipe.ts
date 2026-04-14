import { cn } from "../structure/Box.js"

export const overlayBackdropClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "fixed inset-0 bg-content-primary/35 backdrop-blur-sm transition-opacity duration-150 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )

export const dialogContentClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "fixed left-1/2 top-1/2 z-50 flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-ui-xl border border-border-muted bg-surface-elevated p-5 shadow-ui-floating transition-[opacity,transform] duration-200 ease-out data-[starting-style]:translate-y-[calc(-50%+0.75rem)] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-[calc(-50%+0.75rem)] data-[ending-style]:opacity-0",
    className
  )

export const popoverContentClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-ui-xl border border-border-muted bg-surface-elevated p-4 shadow-ui-floating origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
    className
  )

export const overlayTitleClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "font-family-(--ui-type-section-family) text-(length:--ui-type-section-size) leading-(--ui-type-section-leading) font-weight-(--ui-type-section-weight) tracking-(--ui-type-section-tracking) text-content-primary",
    className
  )

export const overlayDescriptionClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "font-family-(--ui-type-body-sm-family) text-(length:--ui-type-body-sm-size) leading-(--ui-type-body-sm-leading) font-weight-(--ui-type-body-sm-weight) tracking-(--ui-type-body-sm-tracking) text-content-muted",
    className
  )

export const overlayCloseClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "inline-flex size-9 shrink-0 items-center justify-center self-end rounded-ui-pill border border-transparent text-content-muted transition-colors duration-150 ease-out hover:bg-surface-sunken hover:text-content-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30",
    className
  )

export const tooltipContentClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "z-50 max-w-72 rounded-ui-lg border border-border-muted bg-surface-elevated/98 px-3 py-2.5 shadow-ui-floating origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
    className
  )

export const menuPositionerClassName = ({ className }: { readonly className?: string }): string =>
  cn("z-50 min-w-[14rem]", className)

export const menuContentClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "overflow-hidden rounded-ui-xl border border-border-muted bg-surface-elevated/98 p-1 shadow-ui-floating origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
    className
  )

export const menuViewportClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "flex max-h-[min(22rem,var(--available-height))] min-w-[max(12rem,var(--anchor-width))] flex-col gap-1 overflow-auto outline-none",
    className
  )

export const menuGroupClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-1", className)

export const menuGroupLabelClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "px-3 pt-2 pb-1 font-family-(--ui-type-label-family) text-(length:--ui-type-label-size) leading-(--ui-type-label-leading) font-weight-(--ui-type-label-weight) uppercase tracking-(--ui-type-label-tracking) text-content-subtle",
    className
  )

export const menuItemClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "inline-flex min-h-10 w-full min-w-0 items-center gap-3 rounded-ui-md px-3 py-2 text-left text-content-muted outline-none transition-colors duration-150 ease-out data-[highlighted]:bg-surface-sunken data-[highlighted]:text-content-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
    className
  )

export const menuSeparatorClassName = ({ className }: { readonly className?: string }): string =>
  cn("my-1 h-px bg-border-muted/80", className)

export const drawerViewportClassName = ({ className }: { readonly className?: string }): string =>
  cn("fixed inset-0 z-50 overflow-hidden pointer-events-none", className)

const drawerPopupDirectionClassNames: Record<"down" | "left" | "right" | "up", string> = {
  down:
    "inset-x-0 bottom-0 max-h-[min(80vh,42rem)] rounded-t-ui-2xl border-x-0 border-b-0 data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full",
  left:
    "inset-y-0 left-0 w-[min(30rem,calc(100vw-1rem))] rounded-r-ui-2xl border-l-0 border-y-0 data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full",
  right:
    "inset-y-0 right-0 w-[min(30rem,calc(100vw-1rem))] rounded-l-ui-2xl border-r-0 border-y-0 data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
  up:
    "inset-x-0 top-0 max-h-[min(80vh,42rem)] rounded-b-ui-2xl border-x-0 border-t-0 data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full"
}

export const drawerPopupClassName = ({
  className,
  swipeDirection
}: {
  readonly className?: string
  readonly swipeDirection: "down" | "left" | "right" | "up"
}): string =>
  cn(
    "pointer-events-auto absolute flex min-w-0 flex-col border border-border-muted bg-surface-elevated shadow-ui-floating transition-[transform,opacity] duration-200 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    drawerPopupDirectionClassNames[swipeDirection],
    className
  )

export const drawerContentClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex h-full min-h-0 flex-col gap-4 p-5 sm:p-6", className)
