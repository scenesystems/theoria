import { Match, Option } from "effect"

import type { Metadata } from "../../../contracts/envelope.js"
import type { EvidenceItem, EvidenceSection } from "../../../contracts/evidence.js"

import { formatScalar } from "./format.js"

export type EvidencePlaneFilter = "all" | "results" | "data" | "context"

export type EvidencePlaneOrder = "live" | "narrative"

type ScalarEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Scalar" }>
type TextEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Text" }>
type ComparisonEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Comparison" }>
type SeriesEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Series" }>
type TableEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Table" }>

type EvidenceSectionStats = {
  readonly scalarCount: number
  readonly comparisonCount: number
  readonly seriesCount: number
  readonly visualCount: number
  readonly tableCount: number
  readonly textCount: number
}

export type EvidenceMetric = {
  readonly label: string
  readonly value: string
}

export type EvidenceSectionVariant = "highlight" | "analysis" | "context" | "dataset"

export type EvidenceSectionGroup =
  | {
    readonly _tag: "Metrics"
    readonly layout: "hero" | "grid" | "strip"
    readonly metrics: ReadonlyArray<EvidenceMetric>
  }
  | {
    readonly _tag: "Prose"
    readonly items: ReadonlyArray<TextEvidenceItem>
  }
  | {
    readonly _tag: "Visuals"
    readonly items: ReadonlyArray<ComparisonEvidenceItem | SeriesEvidenceItem>
  }
  | {
    readonly _tag: "Table"
    readonly item: TableEvidenceItem
  }

export type EvidenceOption<A> = {
  readonly index: number
  readonly label: string
  readonly value: A
}

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

export type EvidencePlaneLane = {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}

export type EvidencePlaneLayout =
  | {
    readonly _tag: "Focused"
    readonly section: EvidenceSectionViewModel
  }
  | {
    readonly _tag: "Narrative"
    readonly spotlight: EvidenceSectionViewModel | null
    readonly narrative: EvidencePlaneLane | null
    readonly reference: EvidencePlaneLane | null
  }
  | {
    readonly _tag: "Live"
    readonly spotlight: EvidenceSectionViewModel | null
    readonly stream: EvidencePlaneLane | null
  }

export type EvidencePlaneViewModel = {
  readonly overview: {
    readonly eyebrow: string
    readonly description: string
    readonly metrics: ReadonlyArray<EvidenceMetric>
  }
  readonly controls: {
    readonly filterOptions: ReadonlyArray<EvidenceOption<EvidencePlaneFilter>>
    readonly activeFilterIndex: number
    readonly orderOptions: ReadonlyArray<EvidenceOption<EvidencePlaneOrder>>
    readonly activeOrderIndex: number
    readonly sectionOptions: ReadonlyArray<EvidenceOption<string | null>>
    readonly activeSectionIndex: number
  }
  readonly layout: EvidencePlaneLayout
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}

const filterOptions: ReadonlyArray<EvidenceOption<EvidencePlaneFilter>> = [
  { index: 0, label: "All", value: "all" },
  { index: 1, label: "Results", value: "results" },
  { index: 2, label: "Data", value: "data" },
  { index: 3, label: "Context", value: "context" }
]

const orderOptions: ReadonlyArray<EvidenceOption<EvidencePlaneOrder>> = [
  { index: 0, label: "Narrative view", value: "narrative" },
  { index: 1, label: "Live stream", value: "live" }
]

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

const formatDuration = (durationMs: number): string =>
  durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${Math.round(durationMs)} ms`

const itemCountLabel = (count: number): string => count === 1 ? "1 item" : `${count} items`

const variantBadge = (variant: EvidenceSectionVariant): string =>
  Match.value(variant).pipe(
    Match.when("highlight", () => "Results"),
    Match.when("analysis", () => "Analysis"),
    Match.when("context", () => "Context"),
    Match.when("dataset", () => "Dataset"),
    Match.exhaustive
  )

const countLabel = ({
  count,
  plural,
  singular
}: {
  readonly count: number
  readonly plural: string
  readonly singular: string
}): string | null => count === 0 ? null : `${count} ${count === 1 ? singular : plural}`

const nonEmptyLabels = (values: ReadonlyArray<string | null>): ReadonlyArray<string> =>
  values.flatMap((value) => value === null ? [] : [value])

const sectionStats = (items: ReadonlyArray<EvidenceItem>): EvidenceSectionStats => ({
  scalarCount: scalarItems(items).length,
  comparisonCount: comparisonItems(items).length,
  seriesCount: seriesItems(items).length,
  visualCount: visualItems(items).length,
  tableCount: tableItems(items).length,
  textCount: textItems(items).length
})

const highlightTitle = (title: string): boolean =>
  /(comparison|performance|evaluation|results|optimization|power|geometry|timing|generation|size|sensitivity|convergence|reflow)/i
    .test(
      title
    )

const datasetTitle = (title: string): boolean => /(dataset|matrix|grid|examples|sizes|variants)/i.test(title)

const contextTitle = (title: string): boolean =>
  /(scenario|signature|provider|method|verification|envelope|decryption|nonce|corpus|contract|configuration|objective)/i
    .test(
      title
    )

const sectionVariant = ({
  stats,
  title
}: {
  readonly stats: EvidenceSectionStats
  readonly title: string
}): EvidenceSectionVariant => {
  const tableDominant = stats.tableCount > 0 && stats.visualCount === 0 && stats.scalarCount <= 2
  const proseDominant = stats.textCount > Math.max(stats.scalarCount + stats.visualCount, 1) && stats.tableCount === 0

  if (datasetTitle(title) || tableDominant) {
    return stats.visualCount > 0 || stats.scalarCount > 2 ? "analysis" : "dataset"
  }

  if (highlightTitle(title) || stats.visualCount > 0 || stats.scalarCount >= 4) {
    if (stats.tableCount > 0) {
      return "analysis"
    }

    return stats.visualCount > 0 && stats.scalarCount === 0 ? "analysis" : "highlight"
  }

  if (contextTitle(title) || proseDominant) {
    return "context"
  }

  if (stats.tableCount > 0) {
    return stats.visualCount > 0 || stats.scalarCount > 0 ? "analysis" : "dataset"
  }

  return stats.textCount > 0 ? "context" : "analysis"
}

const sectionPriorityScore = ({
  stats,
  title,
  variant
}: {
  readonly stats: EvidenceSectionStats
  readonly title: string
  readonly variant: EvidenceSectionVariant
}): number => {
  const variantWeight = Match.value(variant).pipe(
    Match.when("highlight", () => 8),
    Match.when("analysis", () => 6),
    Match.when("dataset", () => 3),
    Match.when("context", () => 1),
    Match.exhaustive
  )

  return (
    stats.comparisonCount * 8 +
    stats.seriesCount * 7 +
    stats.scalarCount * 2 +
    stats.tableCount +
    variantWeight +
    (highlightTitle(title) ? 3 : 0) +
    (datasetTitle(title) ? 1 : 0) -
    (contextTitle(title) ? 1 : 0)
  )
}

const sectionSummaryText = ({
  itemCount,
  stats,
  variant
}: {
  readonly itemCount: number
  readonly stats: EvidenceSectionStats
  readonly variant: EvidenceSectionVariant
}): string => {
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

const metricLayout = ({
  metrics,
  variant
}: {
  readonly metrics: ReadonlyArray<ScalarEvidenceItem>
  readonly variant: EvidenceSectionVariant
}): Extract<EvidenceSectionGroup, { readonly _tag: "Metrics" }>["layout"] =>
  variant === "highlight" || (variant === "analysis" && metrics.length >= 2)
    ? "hero"
    : metrics.length >= 4
    ? "grid"
    : "strip"

const metricGroup = ({
  metrics,
  variant
}: {
  readonly metrics: ReadonlyArray<ScalarEvidenceItem>
  readonly variant: EvidenceSectionVariant
}): EvidenceSectionGroup => ({
  _tag: "Metrics",
  layout: metricLayout({ metrics, variant }),
  metrics: metrics.map((metric) => ({
    label: metric.label,
    value: formatScalar(metric.value, metric.unit, metric.format)
  }))
})

const baseGroups = ({
  items,
  variant
}: {
  readonly items: ReadonlyArray<EvidenceItem>
  readonly variant: EvidenceSectionVariant
}): ReadonlyArray<EvidenceSectionGroup> => {
  const metrics = scalarItems(items)
  const prose = textItems(items)
  const visuals = visualItems(items)
  const tables = tableItems(items)
  const visualGroups: ReadonlyArray<EvidenceSectionGroup> = visuals.length === 0
    ? []
    : [{ _tag: "Visuals", items: visuals }]
  const proseGroups: ReadonlyArray<EvidenceSectionGroup> = prose.length === 0 ? [] : [{ _tag: "Prose", items: prose }]
  const tableGroups: ReadonlyArray<EvidenceSectionGroup> = tables.map((item) => ({ _tag: "Table", item }))

  return [
    ...(metrics.length === 0 ? [] : [metricGroup({ metrics, variant })]),
    ...visualGroups,
    ...proseGroups,
    ...tableGroups
  ]
}

const groupPriority = ({
  group,
  variant
}: {
  readonly group: EvidenceSectionGroup
  readonly variant: EvidenceSectionVariant
}): number =>
  Match.value(variant).pipe(
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
    Match.when("analysis", () =>
      Match.value(group).pipe(
        Match.tag("Visuals", () => 0),
        Match.tag("Metrics", () => 1),
        Match.tag("Table", () => 2),
        Match.tag("Prose", () => 3),
        Match.exhaustive
      )),
    Match.orElse(() =>
      Match.value(group).pipe(
        Match.tag("Metrics", () => 0),
        Match.tag("Visuals", () => 1),
        Match.tag("Prose", () => 2),
        Match.tag("Table", () => 3),
        Match.exhaustive
      )
    )
  )

const sortGroups = (
  groups: ReadonlyArray<EvidenceSectionGroup>,
  variant: EvidenceSectionVariant
): ReadonlyArray<EvidenceSectionGroup> =>
  [...groups].sort((left, right) => groupPriority({ group: left, variant }) - groupPriority({ group: right, variant }))

const sectionRank = (section: EvidenceSectionViewModel): number =>
  Match.value(section.variant).pipe(
    Match.when("highlight", () => 0),
    Match.when("analysis", () => 1),
    Match.when("context", () => 2),
    Match.when("dataset", () => 3),
    Match.exhaustive
  )

const sectionMatchesFilter = ({
  filter,
  section
}: {
  readonly filter: EvidencePlaneFilter
  readonly section: EvidenceSectionViewModel
}): boolean =>
  Match.value(filter).pipe(
    Match.when("all", () => true),
    Match.when("results", () => section.variant === "highlight" || section.variant === "analysis"),
    Match.when("data", () => section.stats.tableCount > 0 || section.stats.visualCount > 0),
    Match.when("context", () => section.variant === "context" || section.variant === "dataset"),
    Match.exhaustive
  )

const narrativeOrderedSections = (
  sections: ReadonlyArray<EvidenceSectionViewModel>
): ReadonlyArray<EvidenceSectionViewModel> =>
  [...sections].sort(
    (left, right) =>
      sectionRank(left) - sectionRank(right) ||
      right.priorityScore - left.priorityScore ||
      left.originalIndex - right.originalIndex
  )

const liveOrderedSections = (
  sections: ReadonlyArray<EvidenceSectionViewModel>
): ReadonlyArray<EvidenceSectionViewModel> =>
  [...sections].sort((left, right) => right.originalIndex - left.originalIndex)

const projectedSections = (sections: ReadonlyArray<EvidenceSection>): ReadonlyArray<EvidenceSectionViewModel> => {
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
      groups: sortGroups(baseGroups({ items: section.items, variant }), variant)
    }
  })
}

const visibleSections = ({
  filter,
  order,
  sectionKey,
  sections
}: {
  readonly filter: EvidencePlaneFilter
  readonly order: EvidencePlaneOrder
  readonly sectionKey: string | null
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}): ReadonlyArray<EvidenceSectionViewModel> => {
  const filtered = sections.filter((section) => sectionMatchesFilter({ filter, section }))
  const ordered = order === "live" ? liveOrderedSections(filtered) : narrativeOrderedSections(filtered)

  return sectionKey === null ? ordered : ordered.filter((section) => section.key === sectionKey)
}

const aggregateSectionStats = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidenceSectionStats =>
  sections.reduce(
    (totals, section) => ({
      scalarCount: totals.scalarCount + section.stats.scalarCount,
      comparisonCount: totals.comparisonCount + section.stats.comparisonCount,
      seriesCount: totals.seriesCount + section.stats.seriesCount,
      visualCount: totals.visualCount + section.stats.visualCount,
      tableCount: totals.tableCount + section.stats.tableCount,
      textCount: totals.textCount + section.stats.textCount
    }),
    {
      scalarCount: 0,
      comparisonCount: 0,
      seriesCount: 0,
      visualCount: 0,
      tableCount: 0,
      textCount: 0
    }
  )

const activeOptionIndex = <A>(options: ReadonlyArray<EvidenceOption<A>>, value: A): number =>
  Math.max(options.findIndex((option) => option.value === value), 0)

const evidenceLane = ({
  description,
  eyebrow,
  sections,
  title
}: {
  readonly description: string
  readonly eyebrow: string
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
  readonly title: string
}): EvidencePlaneLane | null => sections.length === 0 ? null : { description, eyebrow, sections, title }

const isNarrativeSection = (section: EvidenceSectionViewModel): boolean =>
  section.variant === "highlight" || section.variant === "analysis"

const focusLayout = (
  sections: ReadonlyArray<EvidenceSectionViewModel>
): EvidencePlaneLayout =>
  Option.match(Option.fromNullable(sections[0]), {
    onNone: () => liveLayout(sections),
    onSome: (section) => ({ _tag: "Focused", section })
  })

const narrativeLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout => {
  const primarySections = sections.filter(isNarrativeSection)
  const spotlight = primarySections[0] ?? sections[0] ?? null
  const remainingSections = spotlight === null ? sections : sections.filter((section) => section.key !== spotlight.key)

  return {
    _tag: "Narrative",
    spotlight,
    narrative: evidenceLane({
      description: "Outcome-driven sections and analytic evidence stay in the reading lane.",
      eyebrow: "Narrative",
      sections: remainingSections.filter(isNarrativeSection),
      title: "Results and Analysis"
    }),
    reference: evidenceLane({
      description: "Context, datasets, and contract detail stay nearby without burying the main story.",
      eyebrow: "Reference",
      sections: remainingSections.filter((section) => !isNarrativeSection(section)),
      title: "Context and Data"
    })
  }
}

const liveLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout => {
  const spotlight = sections.find(isNarrativeSection) ?? sections[0] ?? null
  const streamSections = spotlight === null ? sections : sections.filter((section) => section.key !== spotlight.key)

  return {
    _tag: "Live",
    spotlight,
    stream: evidenceLane({
      description: "Newest evidence arrives first so the stream reads like an active log instead of a buried archive.",
      eyebrow: "Live Stream",
      sections: streamSections,
      title: "Newest First"
    })
  }
}

const planeLayout = ({
  order,
  sectionKey,
  sections
}: {
  readonly order: EvidencePlaneOrder
  readonly sectionKey: string | null
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}): EvidencePlaneLayout =>
  sectionKey !== null && sections.length > 0
    ? focusLayout(sections)
    : order === "live"
    ? liveLayout(sections)
    : narrativeLayout(sections)

export const buildEvidencePlaneViewModel = ({
  complete,
  filter,
  meta,
  order,
  sectionKey,
  sections,
  summary
}: {
  readonly complete: boolean
  readonly filter: EvidencePlaneFilter
  readonly meta: Metadata | null
  readonly order: EvidencePlaneOrder
  readonly sectionKey: string | null
  readonly sections: ReadonlyArray<EvidenceSection>
  readonly summary: string | null
}): EvidencePlaneViewModel => {
  const projected = projectedSections(sections)
  const filtered = projected.filter((section) => sectionMatchesFilter({ filter, section }))
  const orderedForControls = order === "live" ? liveOrderedSections(filtered) : narrativeOrderedSections(filtered)
  const sectionOptions: ReadonlyArray<EvidenceOption<string | null>> = [
    { index: 0, label: "All sections", value: null },
    ...orderedForControls.map((section, index) => ({
      index: index + 1,
      label: section.title,
      value: section.key
    }))
  ]
  const activeSectionValue = sectionOptions.some((option) => option.value === sectionKey) ? sectionKey : null
  const visible = visibleSections({
    filter,
    order,
    sectionKey: activeSectionValue,
    sections: projected
  })
  const stats = aggregateSectionStats(visible)
  const runtimeText = meta === null ? null : formatDuration(meta.durationMs)
  const latestSection = projected[projected.length - 1] ?? null
  const layout = planeLayout({
    order,
    sectionKey: activeSectionValue,
    sections: visible
  })

  return {
    overview: {
      eyebrow: complete
        ? `${order === "live" ? "Live stream" : "Narrative view"} · evidence complete${
          runtimeText === null ? "" : ` · ${runtimeText}`
        }`
        : latestSection === null
        ? "Waiting for live evidence"
        : `${order === "live" ? "Live stream" : "Narrative view"} · latest section: ${latestSection.title}`,
      description: activeSectionValue === null
        ? complete
          ? summary ??
            "Decisive results stay promoted while datasets and context remain legible as supporting evidence."
          : order === "live"
          ? "Newest evidence lands first, with the freshest result held above the running stream."
          : "Results stay in the narrative lane while datasets and contract notes collect in a supporting reference lane."
        : `Focused on ${visible[0]?.title ?? "the selected section"}.`,
      metrics: [
        { label: "In view", value: `${visible.length}/${Math.max(projected.length, 1)}` },
        { label: "Metrics", value: String(stats.scalarCount) },
        { label: "Visuals", value: String(stats.visualCount) },
        { label: "Tables", value: String(stats.tableCount) },
        { label: "Notes", value: String(stats.textCount) }
      ]
    },
    controls: {
      filterOptions,
      activeFilterIndex: activeOptionIndex(filterOptions, filter),
      orderOptions,
      activeOrderIndex: activeOptionIndex(orderOptions, order),
      sectionOptions,
      activeSectionIndex: activeOptionIndex(sectionOptions, activeSectionValue)
    },
    layout,
    sections: visible
  }
}
