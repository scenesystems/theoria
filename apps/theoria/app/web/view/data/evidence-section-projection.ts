import { Match } from "effect"

import type { EvidenceItem, EvidenceSection } from "../../../contracts/evidence/item.js"
import type { EvidenceSectionGroup } from "./evidence-section-groups.js"

import { buildEvidenceSectionGroups } from "./evidence-section-groups.js"

type ScalarEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Scalar" }>
type TextEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Text" }>
type ComparisonEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Comparison" }>
type SeriesEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Series" }>
type TableEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Table" }>

export type EvidenceSectionStats = {
  readonly scalarCount: number
  readonly comparisonCount: number
  readonly seriesCount: number
  readonly visualCount: number
  readonly tableCount: number
  readonly textCount: number
}

export type EvidenceSectionVariant = "highlight" | "analysis" | "context" | "dataset"

export type { EvidenceMetric, EvidenceSectionGroup } from "./evidence-section-groups.js"

export type EvidenceSectionViewModel = {
  readonly key: string
  readonly title: string
  readonly badge: string
  readonly eyebrow: string
  readonly itemCountLabel: string
  readonly latest: boolean
  readonly originalIndex: number
  readonly priorityScore: number
  readonly summaryText: string
  readonly variant: EvidenceSectionVariant
  readonly stats: EvidenceSectionStats
  readonly groups: ReadonlyArray<EvidenceSectionGroup>
}

const scalarItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ScalarEvidenceItem> =>
  items.flatMap((item) => item._tag === "Scalar" ? [item] : [])

const comparisonItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ComparisonEvidenceItem> =>
  items.flatMap((item) => item._tag === "Comparison" ? [item] : [])

const seriesItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<SeriesEvidenceItem> =>
  items.flatMap((item) => item._tag === "Series" ? [item] : [])

const textItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<TextEvidenceItem> =>
  items.flatMap((item) => item._tag === "Text" ? [item] : [])

const visualItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ComparisonEvidenceItem | SeriesEvidenceItem> =>
  items.flatMap((item) => item._tag === "Comparison" || item._tag === "Series" ? [item] : [])

const tableItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<TableEvidenceItem> =>
  items.flatMap((item) => item._tag === "Table" ? [item] : [])

const itemCountLabel = (count: number): string => count === 1 ? "1 item" : `${count} items`

const countLabel = (
  { count, plural, singular }: { readonly count: number; readonly plural: string; readonly singular: string }
): string | null => count === 0 ? null : `${count} ${count === 1 ? singular : plural}`

const nonEmptyLabels = (values: ReadonlyArray<string | null>): ReadonlyArray<string> =>
  values.flatMap((value) => value === null ? [] : [value])

const variantBadge = (variant: EvidenceSectionVariant): string =>
  Match.value(variant).pipe(
    Match.when("highlight", () => "Results"),
    Match.when("analysis", () => "Analysis"),
    Match.when("context", () => "Context"),
    Match.when("dataset", () => "Dataset"),
    Match.exhaustive
  )

const highlightTitle = (title: string): boolean =>
  /(comparison|performance|evaluation|results|optimization|power|geometry|timing|generation|size|sensitivity|convergence|reflow)/i
    .test(title)

const datasetTitle = (title: string): boolean => /(dataset|matrix|grid|examples|sizes|variants)/i.test(title)

const contextTitle = (title: string): boolean =>
  /(scenario|signature|provider|method|verification|envelope|decryption|nonce|corpus|contract|configuration|objective)/i
    .test(title)

const sectionStats = (items: ReadonlyArray<EvidenceItem>): EvidenceSectionStats => ({
  scalarCount: scalarItems(items).length,
  comparisonCount: comparisonItems(items).length,
  seriesCount: seriesItems(items).length,
  visualCount: visualItems(items).length,
  tableCount: tableItems(items).length,
  textCount: textItems(items).length
})

const sectionVariant = (
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

const sectionPriorityScore = (
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

const sectionSummaryText = (
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

  return [...parts, itemCountLabel(itemCount)].join(" · ")
}

export const projectEvidenceSections = (
  sections: ReadonlyArray<EvidenceSection>
): ReadonlyArray<EvidenceSectionViewModel> => {
  const latestKey = sections.length === 0 ? null : `section-${String(sections.length).padStart(2, "0")}`

  return sections.map((section, originalIndex) => {
    const stats = sectionStats(section.items)
    const variant = sectionVariant({ stats, title: section.title })
    const key = `section-${String(originalIndex + 1).padStart(2, "0")}`

    return {
      key,
      title: section.title,
      badge: variantBadge(variant),
      eyebrow: variantBadge(variant),
      itemCountLabel: itemCountLabel(section.items.length),
      latest: latestKey === key,
      originalIndex,
      priorityScore: sectionPriorityScore({ stats, title: section.title, variant }),
      summaryText: sectionSummaryText({ itemCount: section.items.length, stats, variant }),
      variant,
      stats,
      groups: buildEvidenceSectionGroups({ items: section.items, variant })
    }
  })
}
