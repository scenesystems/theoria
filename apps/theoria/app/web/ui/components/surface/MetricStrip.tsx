import type { ReactNode } from "react"

import {
  type MetricDensity,
  type MetricEmphasis,
  metricStripCellClassName,
  metricStripClassName,
  metricStripGridClassName,
  type MetricStripVariant,
  type MetricSurface,
  type MetricTone
} from "../../recipes/data-display.recipe.js"
import { Box } from "../../structure/Box.js"
import { Metric } from "./Metric.js"

export type MetricStripItem = {
  readonly detail?: ReactNode
  readonly key?: string
  readonly label: ReactNode
  readonly meta?: ReactNode
  readonly tone?: MetricTone
  readonly value: ReactNode
}

type MetricStripProps = {
  readonly className?: string
  readonly density?: MetricDensity
  readonly emphasis?: MetricEmphasis
  readonly metrics: ReadonlyArray<MetricStripItem>
  readonly surface?: MetricSurface
  readonly variant?: MetricStripVariant
}

export const MetricStrip = ({
  className,
  density = "standard",
  emphasis = "standard",
  metrics,
  surface = "panel",
  variant = "strip"
}: MetricStripProps) => (
  <Box className={metricStripClassName({ emphasis, surface, ...(className === undefined ? {} : { className }) })}>
    <Box className={metricStripGridClassName({ emphasis, metricCount: metrics.length, variant })}>
      {metrics.map((metric, index) => (
        <Box className={metricStripCellClassName({ density, emphasis })} key={metric.key ?? String(index)}>
          <Metric
            density={density}
            detail={metric.detail}
            emphasis={emphasis}
            label={metric.label}
            meta={metric.meta}
            surface="flush"
            {...(metric.tone === undefined ? {} : { tone: metric.tone })}
            value={metric.value}
          />
        </Box>
      ))}
    </Box>
  </Box>
)
