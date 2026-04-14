import type { ReactNode } from "react"

import {
  metricClassName,
  type MetricDensity,
  metricDetailClassName,
  type MetricEmphasis,
  metricLabelClassName,
  metricMetaClassName,
  type MetricSurface,
  type MetricTone,
  metricValueClassName
} from "../../recipes/data-display.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

export type MetricProps = {
  readonly className?: string
  readonly density?: MetricDensity
  readonly detail?: ReactNode
  readonly emphasis?: MetricEmphasis
  readonly label: ReactNode
  readonly meta?: ReactNode
  readonly surface?: MetricSurface
  readonly tone?: MetricTone
  readonly value: ReactNode
}

const metricLabelContent = (label: ReactNode): ReactNode =>
  typeof label === "string" || typeof label === "number"
    ? <SemanticText role="label" tone="inherit">{label}</SemanticText>
    : label

const metricValueContent = ({
  emphasis,
  value
}: {
  readonly emphasis: MetricEmphasis
  readonly value: ReactNode
}): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? (
      <SemanticText as="span" role={emphasis === "hero" ? "display" : "display-sm"} tone="inherit">
        {value}
      </SemanticText>
    )
    : value

const metricDetailContent = (detail: ReactNode): ReactNode =>
  typeof detail === "string" || typeof detail === "number"
    ? <SemanticText role="body-sm" tone="inherit">{detail}</SemanticText>
    : detail

const metricMetaContent = (meta: ReactNode): ReactNode =>
  typeof meta === "string" || typeof meta === "number"
    ? <SemanticText role="body-sm" tone="inherit">{meta}</SemanticText>
    : meta

export const Metric = ({
  className,
  density = "standard",
  detail,
  emphasis = "standard",
  label,
  meta,
  surface = "panel",
  tone = "default",
  value
}: MetricProps) => (
  <Box
    as="dl"
    className={metricClassName({ density, emphasis, surface, ...(className === undefined ? {} : { className }) })}
  >
    <Box as="dt" className={metricLabelClassName({})}>
      {metricLabelContent(label)}
    </Box>
    <Stack gap="xs">
      <Box className="flex min-w-0 flex-wrap items-baseline gap-2">
        <Box as="dd" className={metricValueClassName({ emphasis, tone })}>
          {metricValueContent({ emphasis, value })}
        </Box>
        {detail === undefined
          ? null
          : <Box as="dd" className={metricDetailClassName({ tone })}>{metricDetailContent(detail)}</Box>}
      </Box>
      {meta === undefined ? null : <Box as="dd" className={metricMetaClassName({})}>{metricMetaContent(meta)}</Box>}
    </Stack>
  </Box>
)
