import { Match } from "effect"

import type { EvidenceSectionViewModel } from "./evidence-section-projection.js"

export type EvidencePlaneFilter = "all" | "results" | "data" | "context"
export type EvidencePlaneOrder = "live" | "narrative"

export type EvidenceOption<A> = {
  readonly index: number
  readonly label: string
  readonly value: A
}

export const evidencePlaneFilterOptions: ReadonlyArray<EvidenceOption<EvidencePlaneFilter>> = [
  { index: 0, label: "All", value: "all" },
  { index: 1, label: "Results", value: "results" },
  { index: 2, label: "Data", value: "data" },
  { index: 3, label: "Context", value: "context" }
]

export const evidencePlaneOrderOptions: ReadonlyArray<EvidenceOption<EvidencePlaneOrder>> = [
  { index: 0, label: "Narrative view", value: "narrative" },
  { index: 1, label: "Live stream", value: "live" }
]

const sectionRank = (section: EvidenceSectionViewModel): number =>
  Match.value(section.variant).pipe(
    Match.when("highlight", () => 0),
    Match.when("analysis", () => 1),
    Match.when("context", () => 2),
    Match.when("dataset", () => 3),
    Match.exhaustive
  )

const sectionMatchesFilter = (
  { filter, section }: { readonly filter: EvidencePlaneFilter; readonly section: EvidenceSectionViewModel }
): boolean =>
  Match.value(filter).pipe(
    Match.when("all", () => true),
    Match.when("results", () => section.variant === "highlight" || section.variant === "analysis"),
    Match.when("data", () => section.stats.tableCount > 0 || section.stats.visualCount > 0),
    Match.when("context", () => section.variant === "context" || section.variant === "dataset"),
    Match.exhaustive
  )

export const narrativeOrderedSections = (
  sections: ReadonlyArray<EvidenceSectionViewModel>
): ReadonlyArray<EvidenceSectionViewModel> =>
  [...sections].sort((left, right) =>
    sectionRank(left) - sectionRank(right) || right.priorityScore - left.priorityScore ||
    left.originalIndex - right.originalIndex
  )

export const liveOrderedSections = (
  sections: ReadonlyArray<EvidenceSectionViewModel>
): ReadonlyArray<EvidenceSectionViewModel> =>
  [...sections].sort((left, right) => right.originalIndex - left.originalIndex)

const orderedSections = (
  { order, sections }: {
    readonly order: EvidencePlaneOrder
    readonly sections: ReadonlyArray<EvidenceSectionViewModel>
  }
): ReadonlyArray<EvidenceSectionViewModel> =>
  order === "live" ? liveOrderedSections(sections) : narrativeOrderedSections(sections)

export const evidencePlaneSectionOptions = (
  { filter, order, sections }: {
    readonly filter: EvidencePlaneFilter
    readonly order: EvidencePlaneOrder
    readonly sections: ReadonlyArray<EvidenceSectionViewModel>
  }
): ReadonlyArray<EvidenceOption<string | null>> => [
  { index: 0, label: "All sections", value: null },
  ...orderedSections({ order, sections: sections.filter((section) => sectionMatchesFilter({ filter, section })) }).map((
    section,
    index
  ) => ({
    index: index + 1,
    label: section.title,
    value: section.key
  }))
]

export const normalizedEvidenceSectionKey = (
  { options, sectionKey }: {
    readonly options: ReadonlyArray<EvidenceOption<string | null>>
    readonly sectionKey: string | null
  }
): string | null => sectionKey !== null && options.some((option) => option.value === sectionKey) ? sectionKey : null

export const visibleEvidenceSections = (
  { filter, order, sectionKey, sections }: {
    readonly filter: EvidencePlaneFilter
    readonly order: EvidencePlaneOrder
    readonly sectionKey: string | null
    readonly sections: ReadonlyArray<EvidenceSectionViewModel>
  }
): ReadonlyArray<EvidenceSectionViewModel> => {
  const ordered = orderedSections({
    order,
    sections: sections.filter((section) => sectionMatchesFilter({ filter, section }))
  })

  return sectionKey === null ? ordered : ordered.filter((section) => section.key === sectionKey)
}
