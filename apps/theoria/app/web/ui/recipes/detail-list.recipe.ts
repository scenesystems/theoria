import { cn } from "../structure/Box.js"

export type DetailBadgeTone = "neutral" | "info" | "positive" | "attention" | "danger"

const detailBadgeToneClassNames: Record<DetailBadgeTone, string> = {
  neutral: "border-border-rail bg-surface-detail text-detail-label",
  info: "border-intent-info-border bg-intent-info-surface text-intent-info-content",
  positive: "border-intent-positive-border bg-intent-positive-surface text-intent-positive-content",
  attention: "border-intent-attention-border bg-intent-attention-surface text-intent-attention-content",
  danger: "border-intent-danger-border bg-intent-danger-surface text-intent-danger-content"
}

export const detailListClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-w-0 divide-y divide-border-rail border border-border-rail bg-surface-detail", className)

export const detailRowClassName = ({ className }: { readonly className?: string }): string =>
  cn(
    "grid min-h-[var(--ui-workspace-detail-row-min-height)] min-w-0 grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:gap-4",
    className
  )

export const detailLabelCellClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 items-start justify-between gap-2", className)

export const detailValueCellClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 flex-col gap-2", className)

export const detailBadgeClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: DetailBadgeTone
}): string => cn("inline-flex min-w-0 items-center gap-2 border px-2 py-1", detailBadgeToneClassNames[tone], className)

export const metadataGridClassName = ({ className }: { readonly className?: string }): string =>
  cn("grid min-w-0 grid-cols-1 gap-px border border-border-rail bg-border-rail md:grid-cols-2", className)

export const metadataGridCellClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-w-0 bg-surface-detail px-4 py-3", className)

export const evidenceCalloutClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: DetailBadgeTone
}): string =>
  cn(
    "min-w-0 border-l-2 bg-surface-pane px-4 py-4",
    tone === "neutral"
      ? "border-border-selection"
      : tone === "info"
      ? "border-intent-info-content"
      : tone === "positive"
      ? "border-intent-positive-content"
      : tone === "attention"
      ? "border-intent-attention-content"
      : "border-intent-danger-content",
    className
  )
