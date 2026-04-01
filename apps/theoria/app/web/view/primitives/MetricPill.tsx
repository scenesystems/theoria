import type { MetricPillClasses } from "./designSystem.js"

import { Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type MetricPillVariant = "strip" | "grid"

const variantClassName = (variant: MetricPillVariant): string =>
  variant === "grid"
    ? "items-start gap-0.5"
    : "items-center gap-px"

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
}) => (
  <Stack
    className={`${variantClassName(variant)} transition-opacity duration-150`}
    style={enabled ? undefined : { opacity: 0.45 }}
  >
    <SemanticText
      as="dt"
      className={classes.label}
      role="row-label"
      text={label}
      variant="expanded"
    />
    <SemanticText
      as="dd"
      className={classes.value}
      role="row-value"
      text={value}
      variant="expanded"
    />
  </Stack>
)
