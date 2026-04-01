import { Separator } from "@base-ui-components/react/separator"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type { WidgetMetric } from "../../atoms/widget-view-models.js"

import { metricPillClassesFor, surfaceMaterials } from "./designSystem.js"
import { Cluster, Layer } from "./Layout.js"
import { MetricPill } from "./MetricPill.js"

type MetricStripVariant = "strip" | "grid"

const stripClassName = `${surfaceMaterials.stripPanel} items-stretch px-4 py-2.5`
const gridClassName = "grid grid-cols-2 gap-2 xl:grid-cols-5"
const separatorClassName = "hidden w-px self-stretch bg-stage-300/50 sm:block"

const StripMetric = ({ index, metric }: { readonly index: number; readonly metric: WidgetMetric }) => {
  const enabled = metric.enabled !== false
  const classes = metricPillClassesFor(Option.fromNullable(metric.appearance), enabled)

  return (
    <>
      {index > 0 ? <Separator className={separatorClassName} orientation="vertical" /> : null}
      <MetricPill classes={classes} enabled={enabled} label={metric.label} value={metric.value} />
    </>
  )
}

const GridMetric = ({ metric }: { readonly metric: WidgetMetric }) => {
  const enabled = metric.enabled !== false
  const classes = metricPillClassesFor(Option.fromNullable(metric.appearance), enabled)

  return (
    <Layer className={`${surfaceMaterials.supportPanel} px-3 py-3`}>
      <MetricPill classes={classes} enabled={enabled} label={metric.label} value={metric.value} variant="grid" />
    </Layer>
  )
}

export const MetricStrip = ({
  metrics,
  variant = "strip"
}: {
  readonly metrics: ReadonlyArray<WidgetMetric>
  readonly variant?: MetricStripVariant
}) =>
  variant === "grid"
    ? (
      <Layer as="dl" className={gridClassName}>
        {Arr.map(metrics, (metric) => <GridMetric key={metric.label} metric={metric} />)}
      </Layer>
    )
    : (
      <Cluster as="dl" className={stripClassName}>
        {Arr.map(metrics, (metric, index) => <StripMetric index={index} key={metric.label} metric={metric} />)}
      </Cluster>
    )
