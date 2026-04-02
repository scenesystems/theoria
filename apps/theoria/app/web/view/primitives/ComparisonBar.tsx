import { surfaceMaterials } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type ComparisonBarSurface = "panel" | "flush"

const deltaClassName = (favorable: boolean): string =>
  favorable
    ? "text-tone-math-700"
    : "text-ink-700"

const barWidth = ({
  max,
  value
}: {
  readonly max: number
  readonly value: number
}): string => `${Math.max((Math.abs(value) / max) * 100, 14)}%`

const Measure = ({
  active,
  label,
  value,
  width
}: {
  readonly active: boolean
  readonly label: string
  readonly value: string
  readonly width: string
}) => (
  <Stack className="min-w-0 flex-1 gap-2">
    <Cluster className="items-center justify-between gap-3">
      <SemanticText as="p" className="text-ink-700" role="row-label" text={label} variant="expanded" />
      <SemanticText
        as="p"
        className={`${active ? "text-ink-900" : "text-ink-800"} tabular-nums`}
        role="code-meta"
        text={value}
        variant="expanded"
      />
    </Cluster>
    <Layer className="h-2 overflow-hidden rounded-full bg-stage-100">
      <Layer className={`h-full rounded-full ${active ? "bg-tone-math-500" : "bg-stage-300"}`} style={{ width }} />
    </Layer>
  </Stack>
)

export const ComparisonBar = ({
  baseline,
  surface = "panel",
  label,
  baselineLabel,
  baselineValue,
  improved,
  improvedLabel,
  improvedValue,
  deltaText,
  favorable
}: {
  readonly baseline: number
  readonly surface?: ComparisonBarSurface
  readonly label: string
  readonly baselineLabel?: string
  readonly baselineValue: string
  readonly improved: number
  readonly improvedLabel?: string
  readonly improvedValue: string
  readonly deltaText: string
  readonly favorable: boolean
}) => {
  const maxValue = Math.max(Math.abs(baseline), Math.abs(improved), 1)
  const shellClassName = surface === "flush" ? "border-y border-stage-200/72" : surfaceMaterials.chartFrame
  const bodyClassName = surface === "flush" ? "gap-4 py-3" : "gap-4 px-4 py-3"

  return (
    <Layer className={shellClassName}>
      <Stack className={bodyClassName}>
        <Cluster className="items-end justify-between gap-3">
          <Stack className="gap-0.5">
            <SemanticText as="p" className="text-ink-700" role="row-label" text={label} variant="expanded" />
            <SemanticText
              as="p"
              className={deltaClassName(favorable)}
              role="code-meta"
              text={deltaText}
              variant="expanded"
            />
          </Stack>
          <SemanticText as="p" className="text-ink-500" role="row-label" text="Delta" variant="expanded" />
        </Cluster>
        <Cluster className="items-stretch gap-5">
          <Measure
            active={false}
            label={baselineLabel ?? "Baseline"}
            value={baselineValue}
            width={barWidth({ max: maxValue, value: baseline })}
          />
          <Measure
            active={favorable}
            label={improvedLabel ?? "Improved"}
            value={improvedValue}
            width={barWidth({ max: maxValue, value: improved })}
          />
        </Cluster>
      </Stack>
    </Layer>
  )
}
