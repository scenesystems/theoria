import { surfaceMaterials } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import { StatusPill } from "./StatusPill.js"

const deltaClassName = (favorable: boolean): string =>
  favorable
    ? "bg-tone-math-100 text-tone-math-800"
    : "bg-stage-100 text-ink-700"

export const ComparisonBar = ({
  label,
  baselineLabel,
  baselineValue,
  improvedLabel,
  improvedValue,
  deltaText,
  favorable
}: {
  readonly label: string
  readonly baselineLabel?: string
  readonly baselineValue: string
  readonly improvedLabel?: string
  readonly improvedValue: string
  readonly deltaText: string
  readonly favorable: boolean
}) => (
  <Layer className={surfaceMaterials.evidenceCard}>
    <Stack className="gap-2">
      <Cluster className="items-center justify-between gap-2">
        <SemanticText as="dt" className="text-ink-700" role="row-label" text={label} variant="expanded" />
        <StatusPill className={deltaClassName(favorable)} label={deltaText} />
      </Cluster>
      <Cluster className="gap-6">
        <Stack className="gap-0.5">
          <SemanticText
            as="span"
            className="text-ink-700"
            role="row-label"
            text={baselineLabel ?? "Baseline"}
            variant="expanded"
          />
          <SemanticText
            as="dd"
            className="tabular-nums text-ink-800"
            role="row-value"
            text={baselineValue}
            variant="expanded"
          />
        </Stack>
        <Stack className="gap-0.5">
          <SemanticText
            as="span"
            className="text-ink-700"
            role="row-label"
            text={improvedLabel ?? "Improved"}
            variant="expanded"
          />
          <SemanticText
            as="dd"
            className="tabular-nums text-ink-900"
            role="row-value"
            text={improvedValue}
            variant="expanded"
          />
        </Stack>
      </Cluster>
    </Stack>
  </Layer>
)
