import type { ReactNode } from "react"

import type { PresentationDetailRow } from "../../../contracts/presentation/detail-row.js"
import { Layer, Rail, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type PlaneMetaRailAppearance = "inline" | "panel"

type PlaneMetaRailMetricPresentation = "stack" | "inline"

const shellClassName = (appearance: PlaneMetaRailAppearance): string =>
  appearance === "panel" ? "gap-2.5 border-b border-stage-200/70 pb-3" : "gap-3"

const metricGridClassName = (count: number): string =>
  count <= 2
    ? "grid grid-cols-2 gap-x-4 gap-y-3"
    : count <= 4
    ? "grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4"
    : "grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5"

const metricCellClassName = ({
  index,
  presentation
}: {
  readonly index: number
  readonly presentation: PlaneMetaRailMetricPresentation
}): string =>
  presentation === "inline"
    ? `${index === 0 ? "" : "sm:border-l sm:border-stage-200/68 sm:pl-4"} min-w-0`
    : `${index === 0 ? "" : "sm:border-l sm:border-stage-200/68 sm:pl-4"} min-w-0`

const metricNode = ({
  metric,
  presentation
}: {
  readonly metric: PresentationDetailRow
  readonly presentation: PlaneMetaRailMetricPresentation
}) =>
  presentation === "inline"
    ? (
      <Rail as="div" className="justify-between gap-2">
        <Layer as="dt" className="min-w-0">
          <SemanticText
            as="span"
            className="block max-w-none whitespace-normal text-ink-600"
            role="row-label"
            text={metric.label}
            variant="expanded"
          />
        </Layer>
        <Layer as="dd" className="min-w-0">
          <SemanticText
            as="span"
            className="block max-w-none whitespace-normal text-ink-900"
            role="row-value"
            text={metric.value}
            variant="expanded"
          />
        </Layer>
      </Rail>
    )
    : (
      <Stack className="gap-0.5">
        <Layer as="dt" className="min-w-0">
          <SemanticText
            as="span"
            className="block max-w-none whitespace-normal text-ink-600"
            role="row-label"
            text={metric.label}
            variant="expanded"
          />
        </Layer>
        <Layer as="dd" className="min-w-0">
          <SemanticText
            as="span"
            className="block max-w-none whitespace-normal text-ink-900"
            role="row-value"
            text={metric.value}
            variant="expanded"
          />
        </Layer>
      </Stack>
    )

export const PlaneMetaRail = ({
  action,
  appearance = "inline",
  description,
  eyebrow,
  metricPresentation = "stack",
  metrics = [],
  status
}: {
  readonly action?: ReactNode
  readonly appearance?: PlaneMetaRailAppearance
  readonly description?: string
  readonly eyebrow?: string
  readonly metricPresentation?: PlaneMetaRailMetricPresentation
  readonly metrics?: ReadonlyArray<PresentationDetailRow>
  readonly status?: string
}) => (
  <Stack className={shellClassName(appearance)}>
    <Rail className="items-start justify-between gap-4">
      <Stack className="min-w-0 flex-1 gap-1.5">
        {eyebrow === undefined
          ? null
          : (
            <SemanticText
              as="p"
              className="max-w-none text-ink-600"
              role="row-label"
              text={eyebrow}
              variant="expanded"
            />
          )}
        {description === undefined
          ? null
          : (
            <SemanticText
              as="p"
              className="max-w-none text-ink-900"
              role="status"
              text={description}
              variant="expanded"
            />
          )}
        {status === undefined
          ? null
          : (
            <SemanticText
              as="p"
              className="max-w-none text-ink-600"
              role="code-meta"
              text={status}
              variant="expanded"
            />
          )}
      </Stack>

      {action === undefined ? null : <Layer className="shrink-0">{action}</Layer>}
    </Rail>

    {metrics.length === 0
      ? null
      : (
        <Layer className="border-t border-stage-200/68 pt-3">
          <Layer as="dl" className={metricGridClassName(metrics.length)}>
            {metrics.map((metric, index) => (
              <Layer className={metricCellClassName({ index, presentation: metricPresentation })} key={metric.label}>
                {metricNode({ metric, presentation: metricPresentation })}
              </Layer>
            ))}
          </Layer>
        </Layer>
      )}
  </Stack>
)
