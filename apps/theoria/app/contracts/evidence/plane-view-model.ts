import type { Metadata } from "../envelope.js"

import type { EvidenceSection } from "./item.js"
import { buildEvidencePlaneLayout } from "./plane-layout.js"
import { buildEvidencePlaneOrdering } from "./plane-ordering.js"
import { buildEvidencePlaneOverview } from "./plane-overview.js"
import {
  EvidencePlaneControlsViewModel,
  evidencePlaneFilterOptions,
  evidencePlaneOrderOptions,
  EvidencePlaneProjection,
  type EvidencePlaneSectionOption,
  EvidencePlaneViewModel
} from "./plane-presentation.js"
import { type EvidencePlaneFilter, type EvidencePlaneOrder, EvidencePlanePreferences } from "./plane.js"
import { projectEvidenceSections } from "./section-presentation.js"

const activeOptionIndex = <A>(options: ReadonlyArray<{ readonly value: A }>, value: A): number =>
  Math.max(options.findIndex((option) => option.value === value), 0)

const buildEvidencePlaneControls = ({
  activeSectionKey,
  filter,
  order,
  sectionOptions
}: {
  readonly activeSectionKey: string | null
  readonly filter: EvidencePlaneFilter
  readonly order: EvidencePlaneOrder
  readonly sectionOptions: ReadonlyArray<EvidencePlaneSectionOption>
}): EvidencePlaneControlsViewModel =>
  EvidencePlaneControlsViewModel.make({
    filterOptions: evidencePlaneFilterOptions,
    activeFilterIndex: activeOptionIndex(evidencePlaneFilterOptions, filter),
    orderOptions: evidencePlaneOrderOptions,
    activeOrderIndex: activeOptionIndex(evidencePlaneOrderOptions, order),
    sectionOptions,
    activeSectionIndex: activeOptionIndex(sectionOptions, activeSectionKey)
  })

const buildEvidencePlaneProjection = ({
  filter,
  order,
  sectionKey,
  sections
}: {
  readonly filter: EvidencePlaneFilter
  readonly order: EvidencePlaneOrder
  readonly sectionKey: string | null
  readonly sections: ReadonlyArray<EvidenceSection>
}): EvidencePlaneProjection => {
  const projectedSections = projectEvidenceSections(sections)

  return EvidencePlaneProjection.make({
    ordering: buildEvidencePlaneOrdering({
      filter,
      order,
      sectionKey,
      sections: projectedSections.sections
    }),
    projectedSections
  })
}

export const emptyEvidencePlaneViewModel = ({
  complete
}: {
  readonly complete: boolean
}): EvidencePlaneViewModel => {
  const defaults = EvidencePlanePreferences.defaults()

  return buildEvidencePlaneViewModel({
    complete,
    filter: defaults.filter,
    meta: null,
    order: defaults.order,
    sectionKey: null,
    sections: [],
    summary: null
  })
}

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
  const projection = buildEvidencePlaneProjection({
    filter,
    order,
    sectionKey,
    sections
  })

  return EvidencePlaneViewModel.make({
    overview: buildEvidencePlaneOverview({
      activeSectionKey: projection.ordering.activeSectionKey,
      complete,
      meta,
      order,
      projectedSections: projection.projectedSections.sections,
      summary,
      visibleSections: projection.ordering.visibleSections
    }),
    controls: buildEvidencePlaneControls({
      activeSectionKey: projection.ordering.activeSectionKey,
      filter,
      order,
      sectionOptions: projection.ordering.sectionOptions
    }),
    layout: buildEvidencePlaneLayout({
      order,
      sectionKey: projection.ordering.activeSectionKey,
      sections: projection.ordering.visibleSections
    }),
    projectedSectionCount: projection.projectedSections.sectionCount,
    sections: projection.ordering.visibleSections
  })
}
