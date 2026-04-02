import type { MetricPillClasses } from "./designSystem.js"

import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type MetricPillVariant = "strip" | "grid" | "hero" | "compact"

const variantClassName = (variant: MetricPillVariant): string =>
  variant === "hero"
    ? "h-full justify-between gap-2.5"
    : variant === "compact"
    ? "h-full justify-between gap-1.5"
    : variant === "grid"
    ? "h-full justify-between gap-2"
    : "gap-1"

const valueRole = (variant: MetricPillVariant) => variant === "hero" ? "card-title" : "row-value"

const metricValueClassName = (variant: MetricPillVariant, classes: MetricPillClasses): string =>
  variant === "hero"
    ? `${classes.value} block max-w-none whitespace-normal`
    : `${classes.value} block max-w-none truncate`

const metricSecondaryValueClassName = (variant: MetricPillVariant): string =>
  variant === "hero"
    ? "block max-w-none whitespace-normal text-ink-600"
    : "block max-w-none truncate text-ink-600"

const splitMetricValue = (value: string): { readonly primary: string; readonly secondary: string } | null => {
  const trimmed = value.trim()
  const segments = trimmed.split(/\s+/)

  if (segments.length < 2) {
    return null
  }

  const primary = segments[0] ?? ""
  return /\d/.test(primary) || primary === "∞" ? { primary, secondary: segments.slice(1).join(" ") } : null
}

export const MetricPill = ({
  classes,
  enabled = true,
  label,
  value,
  variant = "strip"
}: {
  readonly classes: MetricPillClasses
  readonly enabled?: boolean
  readonly label: string
  readonly value: string
  readonly variant?: MetricPillVariant
}) => {
  const splitValue = splitMetricValue(value)

  return (
    <Stack
      className={`${variantClassName(variant)} min-w-0 transition-opacity duration-150 ${enabled ? "" : "opacity-45"}`}
    >
      <Layer as="dt" className="min-w-0">
        <SemanticText
          as="span"
          className={`${classes.label} block max-w-none whitespace-nowrap`}
          role="row-label"
          text={label}
          variant="expanded"
        />
      </Layer>
      <Layer as="dd" className="min-w-0">
        <Stack className="gap-0.5">
          <SemanticText
            as="span"
            className={metricValueClassName(variant, classes)}
            role={valueRole(variant)}
            text={splitValue?.primary ?? value}
            variant="expanded"
          />
          {splitValue === null
            ? null
            : (
              <SemanticText
                as="span"
                className={metricSecondaryValueClassName(variant)}
                role={variant === "hero" ? "row-value" : "code-meta"}
                text={splitValue.secondary}
                variant="expanded"
              />
            )}
        </Stack>
      </Layer>
    </Stack>
  )
}
