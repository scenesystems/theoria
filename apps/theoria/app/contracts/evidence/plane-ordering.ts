import { Match } from "effect"

import { EvidencePlaneOrderingProjection, EvidencePlaneSectionOption } from "./plane-presentation.js"
import type { EvidencePlaneFilter, EvidencePlaneOrder } from "./plane.js"
import type { EvidenceSectionViewModel } from "./section-presentation.js"

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

const filteredSections = ({
  filter,
  sections
}: {
  readonly filter: EvidencePlaneFilter
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}): ReadonlyArray<EvidenceSectionViewModel> => sections.filter((section) => sectionMatchesFilter({ filter, section }))

const orderedSections = ({
  order,
  sections
}: {
  readonly order: EvidencePlaneOrder
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}): ReadonlyArray<EvidenceSectionViewModel> =>
  order === "live" ? liveOrderedSections(sections) : narrativeOrderedSections(sections)

export const evidencePlaneSectionOptions = ({
  filter,
  order,
  sections
}: {
  readonly filter: EvidencePlaneFilter
  readonly order: EvidencePlaneOrder
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}): ReadonlyArray<EvidencePlaneSectionOption> => {
  const ordered = orderedSections({
    order,
    sections: filteredSections({ filter, sections })
  })

  return [
    EvidencePlaneSectionOption.make({ index: 0, label: "All sections", value: null }),
    ...ordered.map((section, index) =>
      EvidencePlaneSectionOption.make({
        index: index + 1,
        label: section.title,
        value: section.key
      })
    )
  ]
}

export const normalizedEvidenceSectionKey = ({
  options,
  sectionKey
}: {
  readonly options: ReadonlyArray<EvidencePlaneSectionOption>
  readonly sectionKey: string | null
}): string | null => sectionKey !== null && options.some((option) => option.value === sectionKey) ? sectionKey : null

export const visibleEvidenceSections = ({
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
  const ordered = orderedSections({
    order,
    sections: filteredSections({ filter, sections })
  })

  return sectionKey === null ? ordered : ordered.filter((section) => section.key === sectionKey)
}

export const buildEvidencePlaneOrdering = ({
  filter,
  order,
  sectionKey,
  sections
}: {
  readonly filter: EvidencePlaneFilter
  readonly order: EvidencePlaneOrder
  readonly sectionKey: string | null
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}): EvidencePlaneOrderingProjection => {
  const sectionOptions = evidencePlaneSectionOptions({ filter, order, sections })
  const activeSectionKey = normalizedEvidenceSectionKey({ options: sectionOptions, sectionKey })

  return EvidencePlaneOrderingProjection.make({
    activeSectionKey,
    sectionOptions,
    visibleSections: visibleEvidenceSections({
      filter,
      order,
      sectionKey: activeSectionKey,
      sections
    })
  })
}
