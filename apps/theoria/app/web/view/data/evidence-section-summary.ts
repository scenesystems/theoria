import { Match } from "effect"

import type { EvidenceSectionStats, EvidenceSectionVariant } from "../../../contracts/evidence/section-presentation.js"

export type { EvidenceSectionVariant } from "../../../contracts/evidence/section-presentation.js"

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
