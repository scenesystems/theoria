import { surfaceMaterials } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type MetricCardSurface = "panel" | "flush"

const metricCardClassName = (surface: MetricCardSurface): string =>
  surface === "flush"
    ? "border-y border-stage-200/72 py-3"
    : surfaceMaterials.evidenceCard

export const MetricCard = ({
  label,
  surface = "panel",
  value,
  unit
}: {
  readonly label: string
  readonly surface?: MetricCardSurface
  readonly value: string
  readonly unit?: string
}) => (
  <Layer className={metricCardClassName(surface)}>
    <Stack className="gap-1">
      <SemanticText as="dt" className="text-ink-700" role="row-label" text={label} variant="expanded" />
      <Cluster className="items-baseline gap-1.5">
        <SemanticText as="dd" className="tabular-nums text-ink-900" role="row-value" text={value} variant="expanded" />
        {unit !== undefined && unit.length > 0
          ? <SemanticText as="span" className="text-ink-700" role="code-meta" text={unit} variant="expanded" />
          : null}
      </Cluster>
    </Stack>
  </Layer>
)
