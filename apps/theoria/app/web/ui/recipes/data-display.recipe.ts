import { cn } from "../structure/Box.js"

export type MetricTone = "default" | "muted" | "accent" | "positive" | "attention" | "danger"
export type MetricSurface = "panel" | "flush"
export type MetricDensity = "standard" | "compact"
export type MetricEmphasis = "standard" | "hero"
export type MetricStripVariant = "strip" | "grid"

export type DataTableDensity = "standard" | "compact"
export type DataTableLayout = "default" | "trace"
export type DataTableColumnAlign = "start" | "end"
export type DataTableColumnWidth = "index" | "measure" | "detail" | "wide"

const metricValueToneClassNames: Record<MetricTone, string> = {
  default: "text-content-primary",
  muted: "text-content-muted",
  accent: "text-accent-solid",
  positive: "text-intent-positive-content",
  attention: "text-intent-attention-content",
  danger: "text-intent-danger-content"
}

const metricDetailToneClassNames: Record<MetricTone, string> = {
  default: "text-content-muted",
  muted: "text-content-subtle",
  accent: "text-accent-solid",
  positive: "text-intent-positive-content",
  attention: "text-intent-attention-content",
  danger: "text-intent-danger-content"
}

const metricSurfaceClassNames: Record<MetricSurface, string> = {
  panel: "rounded-ui-xl border border-border-muted bg-surface-panel/96 px-4 py-3 shadow-ui-chip",
  flush: "px-0 py-0"
}

const metricDensityClassNames: Record<MetricDensity, string> = {
  standard: "gap-1.5",
  compact: "gap-1"
}

const metricEmphasisClassNames: Record<MetricEmphasis, string> = {
  standard: "min-h-[5rem]",
  hero: "min-h-[7rem]"
}

const metricStripSurfaceClassNames: Record<MetricSurface, string> = {
  panel: "overflow-hidden rounded-ui-xl border border-border-muted bg-surface-panel/96 shadow-ui-chip",
  flush: "overflow-hidden border-y border-border-muted bg-transparent"
}

const dataTableLayoutClassNames: Record<DataTableLayout, string> = {
  default: "overflow-x-auto rounded-ui-xl border border-border-muted bg-surface-panel/96 shadow-ui-chip",
  trace: "overflow-x-auto rounded-ui-xl border border-border-muted bg-surface-canvas/92 shadow-ui-chip"
}

const dataTableDensityPaddingClassNames: Record<DataTableDensity, string> = {
  standard: "px-3 py-2.5 sm:px-4 sm:py-3",
  compact: "px-3 py-2"
}

const dataTableColumnWidthClassNames: Record<DataTableColumnWidth, string> = {
  index: "w-[4.5rem]",
  measure: "w-[10rem]",
  detail: "w-[16rem]",
  wide: "w-[24rem]"
}

const dataTableColumnAlignClassNames: Record<DataTableColumnAlign, string> = {
  start: "text-left",
  end: "text-right"
}

export const metricClassName = ({
  className,
  density,
  emphasis,
  surface
}: {
  readonly className?: string
  readonly density: MetricDensity
  readonly emphasis: MetricEmphasis
  readonly surface: MetricSurface
}): string =>
  cn(
    "flex min-w-0 flex-col",
    metricSurfaceClassNames[surface],
    metricDensityClassNames[density],
    metricEmphasisClassNames[emphasis],
    className
  )

export const metricLabelClassName = ({ className }: { readonly className?: string }): string =>
  cn("text-content-subtle", className)

export const metricValueClassName = ({
  className,
  emphasis,
  tone
}: {
  readonly className?: string
  readonly emphasis: MetricEmphasis
  readonly tone: MetricTone
}): string =>
  cn(
    "min-w-0 tabular-nums whitespace-normal break-words",
    emphasis === "hero"
      ? "font-family-(--ui-type-title-family) text-(length:--ui-type-title-size) leading-(--ui-type-title-leading) font-weight-(--ui-type-title-weight) tracking-(--ui-type-title-tracking)"
      : undefined,
    metricValueToneClassNames[tone],
    className
  )

export const metricDetailClassName = ({
  className,
  tone
}: {
  readonly className?: string
  readonly tone: MetricTone
}): string => cn("min-w-0 whitespace-normal break-words", metricDetailToneClassNames[tone], className)

export const metricMetaClassName = ({ className }: { readonly className?: string }): string =>
  cn("text-content-muted", className)

export const metricStripClassName = ({
  className,
  emphasis,
  surface
}: {
  readonly className?: string
  readonly emphasis: MetricEmphasis
  readonly surface: MetricSurface
}): string =>
  cn(
    metricStripSurfaceClassNames[surface],
    emphasis === "hero" ? "bg-surface-elevated/92" : undefined,
    className
  )

export const metricStripGridClassName = ({
  emphasis,
  metricCount,
  variant
}: {
  readonly emphasis: MetricEmphasis
  readonly metricCount: number
  readonly variant: MetricStripVariant
}): string =>
  emphasis === "hero"
    ? metricCount >= 5
      ? "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
      : "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
    : variant === "grid"
    ? metricCount >= 5
      ? "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
      : "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
    : metricCount <= 2
    ? "grid auto-rows-fr grid-cols-1 sm:grid-cols-2"
    : metricCount <= 4
    ? "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
    : "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"

export const metricStripCellClassName = ({
  density,
  emphasis
}: {
  readonly density: MetricDensity
  readonly emphasis: MetricEmphasis
}): string =>
  cn(
    "flex min-w-0 border-r border-b border-border-muted/80",
    emphasis === "hero"
      ? "min-h-[7.5rem] px-4 py-3.5 sm:px-5"
      : density === "compact"
      ? "min-h-[5rem] px-3 py-2"
      : "min-h-[6rem] px-4 py-2.5"
  )

export const dataTableClassName = ({
  className,
  layout
}: {
  readonly className?: string
  readonly layout: DataTableLayout
}): string => cn(dataTableLayoutClassNames[layout], className)

export const dataTableMinWidthClassName = ({
  columnCount,
  layout,
  wideColumnCount
}: {
  readonly columnCount: number
  readonly layout: DataTableLayout
  readonly wideColumnCount: number
}): string => layout === "trace" || wideColumnCount >= 2 || columnCount >= 6 ? "min-w-[72rem]" : "min-w-[58rem]"

export const dataTableColumnClassName = (width: DataTableColumnWidth): string => dataTableColumnWidthClassNames[width]

export const dataTableHeadRowClassName = ({ density }: { readonly density: DataTableDensity }): string =>
  cn(
    "border-b border-border-muted/80",
    density === "compact" ? "bg-surface-sunken/72" : "bg-surface-canvas/70"
  )

export const dataTableHeaderCellClassName = ({
  align,
  density
}: {
  readonly align: DataTableColumnAlign
  readonly density: DataTableDensity
}): string =>
  cn(
    dataTableDensityPaddingClassNames[density],
    dataTableColumnAlignClassNames[align],
    "align-top text-content-muted"
  )

export const dataTableBodyRowClassName = ({ density }: { readonly density: DataTableDensity }): string =>
  cn(
    "border-b border-border-muted/50 transition-colors hover:bg-surface-sunken/56 last:border-b-0",
    density === "compact" ? "align-top" : undefined
  )

export const dataTableCellClassName = ({
  align,
  density
}: {
  readonly align: DataTableColumnAlign
  readonly density: DataTableDensity
}): string =>
  cn(
    dataTableDensityPaddingClassNames[density],
    dataTableColumnAlignClassNames[align],
    "align-top text-content-primary"
  )

export const dataTableEmptyCellClassName = ({ density }: { readonly density: DataTableDensity }): string =>
  cn(dataTableDensityPaddingClassNames[density], "text-center text-content-muted")
