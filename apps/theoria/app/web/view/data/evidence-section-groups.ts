import { Match } from "effect"

import type { EvidenceItem } from "../../../contracts/evidence/item.js"
import {
  EvidenceMetric,
  type EvidenceSectionGroup,
  EvidenceSectionMetricsGroup,
  EvidenceSectionProseGroup,
  EvidenceSectionTableGroup,
  type EvidenceSectionVariant,
  EvidenceSectionVisualsGroup
} from "../../../contracts/evidence/section-presentation.js"

import { formatScalar } from "./format.js"

type ScalarEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Scalar" }>
type TextEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Text" }>
type ComparisonEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Comparison" }>
type SeriesEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Series" }>
type TableEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Table" }>

export type { EvidenceMetric, EvidenceSectionGroup } from "../../../contracts/evidence/section-presentation.js"

const scalarItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ScalarEvidenceItem> =>
  items.flatMap((item) => item._tag === "Scalar" ? [item] : [])

const textItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<TextEvidenceItem> =>
  items.flatMap((item) => item._tag === "Text" ? [item] : [])

const visualItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ComparisonEvidenceItem | SeriesEvidenceItem> =>
  items.flatMap((item) => item._tag === "Comparison" || item._tag === "Series" ? [item] : [])

const tableItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<TableEvidenceItem> =>
  items.flatMap((item) => item._tag === "Table" ? [item] : [])

const metricGroup = ({
  metrics,
  variant
}: {
  readonly metrics: ReadonlyArray<ScalarEvidenceItem>
  readonly variant: EvidenceSectionVariant
}): EvidenceSectionMetricsGroup =>
  EvidenceSectionMetricsGroup.make({
    layout: variant === "highlight" || (variant === "analysis" && metrics.length >= 2)
      ? "hero"
      : metrics.length >= 4
      ? "grid"
      : "strip",
    metrics: metrics.map((metric) =>
      EvidenceMetric.make({
        label: metric.label,
        value: formatScalar(metric.value, metric.unit, metric.format)
      })
    )
  })

const visualGroup = (
  items: ReadonlyArray<ComparisonEvidenceItem | SeriesEvidenceItem>
): EvidenceSectionVisualsGroup => EvidenceSectionVisualsGroup.make({ items })

const proseGroup = (
  items: ReadonlyArray<TextEvidenceItem>
): EvidenceSectionProseGroup => EvidenceSectionProseGroup.make({ items })

const tableGroup = (item: TableEvidenceItem): EvidenceSectionTableGroup => EvidenceSectionTableGroup.make({ item })

const groupOrder = ({
  group,
  variant
}: {
  readonly group: EvidenceSectionGroup
  readonly variant: EvidenceSectionVariant
}): number =>
  Match.value(variant).pipe(
    Match.when("highlight", () =>
      Match.value(group).pipe(
        Match.tag("Metrics", () => 0),
        Match.tag("Visuals", () => 1),
        Match.tag("Prose", () => 2),
        Match.tag("Table", () => 3),
        Match.exhaustive
      )),
    Match.when("analysis", () =>
      Match.value(group).pipe(
        Match.tag("Visuals", () => 0),
        Match.tag("Metrics", () => 1),
        Match.tag("Table", () => 2),
        Match.tag("Prose", () => 3),
        Match.exhaustive
      )),
    Match.when("context", () =>
      Match.value(group).pipe(
        Match.tag("Prose", () => 0),
        Match.tag("Metrics", () => 1),
        Match.tag("Visuals", () => 2),
        Match.tag("Table", () => 3),
        Match.exhaustive
      )),
    Match.when("dataset", () =>
      Match.value(group).pipe(
        Match.tag("Table", () => 0),
        Match.tag("Metrics", () => 1),
        Match.tag("Prose", () => 2),
        Match.tag("Visuals", () => 3),
        Match.exhaustive
      )),
    Match.exhaustive
  )

export const buildEvidenceSectionGroups = ({
  items,
  variant
}: {
  readonly items: ReadonlyArray<EvidenceItem>
  readonly variant: EvidenceSectionVariant
}): ReadonlyArray<EvidenceSectionGroup> => {
  const metrics = scalarItems(items)
  const visuals = visualItems(items)
  const prose = textItems(items)
  const groups: ReadonlyArray<EvidenceSectionGroup> = [
    ...(metrics.length === 0 ? [] : [metricGroup({ metrics, variant })]),
    ...(visuals.length === 0 ? [] : [visualGroup(visuals)]),
    ...(prose.length === 0 ? [] : [proseGroup(prose)]),
    ...tableItems(items).map(tableGroup)
  ]

  return [...groups].sort((left, right) => groupOrder({ group: left, variant }) - groupOrder({ group: right, variant }))
}
