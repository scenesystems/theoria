import { Match, Schema } from "effect"

import type { EvidenceSection } from "./item.js"
import { ComparisonItem, SeriesItem, TableItem, TextItem } from "./item.js"

import { buildEvidenceSectionGroups } from "./section-groups.js"
import { buildEvidenceSectionStats } from "./section-stats.js"

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

const sectionKeyFor = (index: number): string => `section-${String(index + 1).padStart(2, "0")}`

const countLabel = (
  { count, plural, singular }: { readonly count: number; readonly plural: string; readonly singular: string }
): string | null => count === 0 ? null : `${count} ${count === 1 ? singular : plural}`

const nonEmptyLabels = (values: ReadonlyArray<string | null>): ReadonlyArray<string> =>
  values.flatMap((value) => value === null ? [] : [value])

const highlightTitle = (title: string): boolean =>
  /(comparison|performance|evaluation|results|optimization|power|geometry|timing|generation|size|sensitivity|convergence|reflow)/i
    .test(title)

const datasetTitle = (title: string): boolean => /(dataset|matrix|grid|examples|sizes|variants)/i.test(title)

const contextTitle = (title: string): boolean =>
  /(scenario|signature|provider|method|verification|envelope|decryption|nonce|corpus|contract|configuration|objective)/i
    .test(title)

export const evidenceSectionItemCountLabel = (count: number): string => count === 1 ? "1 item" : `${count} items`

export const evidenceSectionLatestLabel = ({
  latest,
  spotlight
}: {
  readonly latest: boolean
  readonly spotlight: boolean
}): string | null => latest ? spotlight ? "Live now" : "Newest evidence" : null

export const evidenceSectionBadge = (variant: EvidenceSectionVariant): string =>
  Match.value(variant).pipe(
    Match.when("highlight", () => "Results"),
    Match.when("analysis", () => "Analysis"),
    Match.when("context", () => "Context"),
    Match.when("dataset", () => "Dataset"),
    Match.exhaustive
  )

export const evidenceSectionVariantFor = (
  { stats, title }: { readonly stats: EvidenceSectionStats; readonly title: string }
): EvidenceSectionVariant => {
  const tableDominant = stats.tableCount > 0 && stats.visualCount === 0 && stats.scalarCount <= 2
  const proseDominant = stats.textCount > Math.max(stats.scalarCount + stats.visualCount, 1) && stats.tableCount === 0

  if (datasetTitle(title) || tableDominant) {
    return stats.visualCount > 0 || stats.scalarCount > 2 ? "analysis" : "dataset"
  }
  if (highlightTitle(title) || stats.visualCount > 0 || stats.scalarCount >= 4) {
    return stats.tableCount > 0 || (stats.visualCount > 0 && stats.scalarCount === 0) ? "analysis" : "highlight"
  }
  if (contextTitle(title) || proseDominant) {
    return "context"
  }
  if (stats.tableCount > 0) {
    return stats.visualCount > 0 || stats.scalarCount > 0 ? "analysis" : "dataset"
  }

  return stats.textCount > 0 ? "context" : "analysis"
}

export const evidenceSectionPriorityScore = (
  { stats, title, variant }: {
    readonly stats: EvidenceSectionStats
    readonly title: string
    readonly variant: EvidenceSectionVariant
  }
): number => {
  const variantWeight = Match.value(variant).pipe(
    Match.when("highlight", () => 8),
    Match.when("analysis", () => 6),
    Match.when("dataset", () => 3),
    Match.when("context", () => 1),
    Match.exhaustive
  )

  return stats.comparisonCount * 8 + stats.seriesCount * 7 + stats.scalarCount * 2 + stats.tableCount + variantWeight +
    (highlightTitle(title) ? 3 : 0) + (datasetTitle(title) ? 1 : 0) - (contextTitle(title) ? 1 : 0)
}

export const evidenceSectionSummaryText = (
  { itemCount, stats, variant }: {
    readonly itemCount: number
    readonly stats: EvidenceSectionStats
    readonly variant: EvidenceSectionVariant
  }
): string => {
  const parts = Match.value(variant).pipe(
    Match.when("highlight", () =>
      nonEmptyLabels([
        countLabel({ count: stats.comparisonCount, plural: "comparisons", singular: "comparison" }),
        countLabel({ count: stats.seriesCount, plural: "series", singular: "series" }),
        countLabel({ count: stats.scalarCount, plural: "metrics", singular: "metric" }),
        countLabel({ count: stats.textCount, plural: "notes", singular: "note" })
      ])),
    Match.when("analysis", () =>
      nonEmptyLabels([
        countLabel({ count: stats.visualCount, plural: "visuals", singular: "visual" }),
        countLabel({ count: stats.tableCount, plural: "tables", singular: "table" }),
        countLabel({ count: stats.scalarCount, plural: "metrics", singular: "metric" }),
        countLabel({ count: stats.textCount, plural: "notes", singular: "note" })
      ])),
    Match.when("dataset", () =>
      nonEmptyLabels([
        countLabel({ count: stats.tableCount, plural: "tables", singular: "table" }),
        countLabel({ count: stats.scalarCount, plural: "metrics", singular: "metric" }),
        countLabel({ count: stats.textCount, plural: "notes", singular: "note" })
      ])),
    Match.when("context", () =>
      nonEmptyLabels([
        countLabel({ count: stats.textCount, plural: "notes", singular: "note" }),
        countLabel({ count: stats.scalarCount, plural: "metrics", singular: "metric" }),
        countLabel({ count: stats.tableCount, plural: "tables", singular: "table" })
      ])),
    Match.exhaustive
  )

  return [...parts, evidenceSectionItemCountLabel(itemCount)].join(" · ")
}

export const projectEvidenceSections = (
  sections: ReadonlyArray<EvidenceSection>
): EvidenceSectionProjection => {
  const latestKey = sections.length === 0 ? null : sectionKeyFor(sections.length - 1)

  return EvidenceSectionProjection.make({
    sectionCount: sections.length,
    sections: sections.map((section, originalIndex) => {
      const stats = buildEvidenceSectionStats(section.items)
      const variant = evidenceSectionVariantFor({ stats, title: section.title })
      const key = sectionKeyFor(originalIndex)

      return EvidenceSectionViewModel.make({
        key,
        title: section.title,
        badge: evidenceSectionBadge(variant),
        eyebrow: evidenceSectionBadge(variant),
        itemCountLabel: evidenceSectionItemCountLabel(section.items.length),
        latest: latestKey === key,
        originalIndex,
        priorityScore: evidenceSectionPriorityScore({ stats, title: section.title, variant }),
        summaryText: evidenceSectionSummaryText({ itemCount: section.items.length, stats, variant }),
        variant,
        stats,
        groups: buildEvidenceSectionGroups({ items: section.items, variant })
      })
    })
  })
}
