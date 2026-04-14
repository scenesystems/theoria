import { cn } from "../structure/Box.js"

export const traceAnnotationComposerClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-4 border border-border-pane bg-surface-pane p-4", className)

export const traceAnnotationKindListClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center gap-2", className)

export const traceAnnotationKindButtonClassName = ({
  className,
  selected
}: {
  readonly className?: string
  readonly selected: boolean
}): string =>
  cn(
    "rounded-ui-pill border px-3 py-1.5 transition-colors duration-150 ease-out",
    selected
      ? "border-border-selection bg-accent-surface text-accent-solid"
      : "border-border-rail bg-surface-detail text-content-secondary hover:border-border-pane hover:bg-surface-toolbar",
    className
  )

export const traceAnnotationListClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-3", className)

export const traceAnnotationCardClassName = ({
  className,
  selected
}: {
  readonly className?: string
  readonly selected: boolean
}): string =>
  cn(
    "flex min-w-0 flex-col gap-3 border bg-surface-pane p-4 transition-[border-color,background-color] duration-150 ease-out",
    selected ? "border-border-selection bg-accent-surface/40" : "border-border-pane",
    className
  )

export const traceAnnotationMetaClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-wrap items-center justify-between gap-2", className)

export const traceAnnotationSelectionClassName = ({ className }: { readonly className?: string }): string =>
  cn("border border-border-rail bg-surface-detail px-3 py-2", className)
