import { Schema } from "effect"

import { ComparisonItem, SeriesItem, TableItem, TextItem } from "./item.js"

export const EvidenceSectionVariant = Schema.Literal("highlight", "analysis", "context", "dataset")

export type EvidenceSectionVariant = typeof EvidenceSectionVariant.Type

export const EvidenceMetricLayout = Schema.Literal("hero", "grid", "strip")

export type EvidenceMetricLayout = typeof EvidenceMetricLayout.Type

export class EvidenceMetric extends Schema.Class<EvidenceMetric>("EvidenceMetric")({
  label: Schema.String,
  value: Schema.String
}) {}

export class EvidenceSectionStats extends Schema.Class<EvidenceSectionStats>("EvidenceSectionStats")({
  scalarCount: Schema.Number,
  comparisonCount: Schema.Number,
  seriesCount: Schema.Number,
  visualCount: Schema.Number,
  tableCount: Schema.Number,
  textCount: Schema.Number
}) {}

const EvidenceVisualItem = Schema.Union(ComparisonItem, SeriesItem)

export class EvidenceSectionMetricsGroup extends Schema.TaggedClass<EvidenceSectionMetricsGroup>()("Metrics", {
  layout: EvidenceMetricLayout,
  metrics: Schema.Array(EvidenceMetric)
}) {}

export class EvidenceSectionProseGroup extends Schema.TaggedClass<EvidenceSectionProseGroup>()("Prose", {
  items: Schema.Array(TextItem)
}) {}

export class EvidenceSectionVisualsGroup extends Schema.TaggedClass<EvidenceSectionVisualsGroup>()("Visuals", {
  items: Schema.Array(EvidenceVisualItem)
}) {}

export class EvidenceSectionTableGroup extends Schema.TaggedClass<EvidenceSectionTableGroup>()("Table", {
  item: TableItem
}) {}

export const EvidenceSectionGroup = Schema.Union(
  EvidenceSectionMetricsGroup,
  EvidenceSectionProseGroup,
  EvidenceSectionVisualsGroup,
  EvidenceSectionTableGroup
)

export type EvidenceSectionGroup = typeof EvidenceSectionGroup.Type

export class EvidenceSectionViewModel extends Schema.Class<EvidenceSectionViewModel>("EvidenceSectionViewModel")({
  key: Schema.String,
  title: Schema.String,
  badge: Schema.String,
  eyebrow: Schema.String,
  itemCountLabel: Schema.String,
  latest: Schema.Boolean,
  originalIndex: Schema.Number,
  priorityScore: Schema.Number,
  summaryText: Schema.String,
  variant: EvidenceSectionVariant,
  stats: EvidenceSectionStats,
  groups: Schema.Array(EvidenceSectionGroup)
}) {}

export class EvidenceSectionProjection extends Schema.Class<EvidenceSectionProjection>("EvidenceSectionProjection")({
  sectionCount: Schema.Number,
  sections: Schema.Array(EvidenceSectionViewModel)
}) {}
