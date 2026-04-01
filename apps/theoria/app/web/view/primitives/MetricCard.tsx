import { surfaceMaterials } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

export const MetricCard = ({
  label,
  value,
  unit
}: {
  readonly label: string
  readonly value: string
  readonly unit?: string
}) => (
  <Layer className={surfaceMaterials.evidenceCard}>
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
