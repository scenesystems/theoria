import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { Layer } from "./Layout.js"
import { MetricPill } from "./MetricPill.js"
import { surfaceMaterials } from "./theme/surface.js"
import type { MetricAppearance } from "./theme/tone.js"
import { metricPillClassesFor } from "./theme/tone.js"

type MetricStripVariant = "strip" | "grid"

type MetricStripEmphasis = "standard" | "hero"

type MetricStripDensity = "standard" | "compact"

type MetricStripSurface = "panel" | "flush"

export type DisplayMetric = {
  readonly label: string
  readonly value: string
  readonly appearance?: MetricAppearance
  readonly enabled?: boolean
}

const shellClassName = ({
  emphasis,
  surface
}: {
  readonly emphasis: MetricStripEmphasis
  readonly surface: MetricStripSurface
}): string =>
  surface === "flush"
    ? `overflow-hidden border-y ${emphasis === "hero" ? "border-stage-300/82" : "border-stage-200/72"} bg-transparent`
    : emphasis === "hero"
    ? surfaceMaterials.metricHeroPanel
    : surfaceMaterials.stripPanel

const columnsClassName = ({
  emphasis,
  metricCount,
  variant
}: {
  readonly emphasis: MetricStripEmphasis
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

const cellClassName = ({
  density,
  emphasis
}: {
  readonly density: MetricStripDensity
  readonly emphasis: MetricStripEmphasis
}): string =>
  `${
    emphasis === "hero"
      ? "min-h-[7.5rem] px-4 py-3.5 sm:px-5"
      : density === "compact"
      ? "min-h-[5rem] px-3 py-2"
      : "min-h-[6.25rem] px-4 py-2.5"
  } flex border-r border-b border-stage-200/72`

const metricNode = ({
  density,
  emphasis,
  metric,
  variant
}: {
  readonly density: MetricStripDensity
  readonly emphasis: MetricStripEmphasis
  readonly metric: DisplayMetric
  readonly variant: MetricStripVariant
}) => {
  const enabled = metric.enabled !== false
  const classes = metricPillClassesFor(Option.fromNullable(metric.appearance), enabled)

  return (
    <MetricPill
      classes={classes}
      enabled={enabled}
      label={metric.label}
      value={metric.value}
      variant={emphasis === "hero" ? "hero" : density === "compact" ? "compact" : variant}
    />
  )
}

export const MetricStrip = ({
  density = "standard",
  emphasis = "standard",
  metrics,
  surface = "panel",
  variant = "strip"
}: {
  readonly density?: MetricStripDensity
  readonly emphasis?: MetricStripEmphasis
  readonly metrics: ReadonlyArray<DisplayMetric>
  readonly surface?: MetricStripSurface
  readonly variant?: MetricStripVariant
}) => (
  <Layer className={shellClassName({ emphasis, surface })}>
    <Layer as="dl" className={`-mb-px -mr-px ${columnsClassName({ emphasis, metricCount: metrics.length, variant })}`}>
      {Arr.map(metrics, (metric) => (
        <Layer className={cellClassName({ density, emphasis })} key={metric.label}>
          {metricNode({ density, emphasis, metric, variant })}
        </Layer>
      ))}
    </Layer>
  </Layer>
)
