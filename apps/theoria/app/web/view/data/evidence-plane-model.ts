import type { Metadata } from "../../../contracts/envelope.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import { EvidencePlaneViewModel } from "../../../contracts/evidence/plane-presentation.js"
import {
  defaultEvidencePlanePreferences,
  type EvidencePlaneFilter,
  type EvidencePlaneOrder
} from "../../../contracts/evidence/plane.js"

import { buildEvidencePlaneControls } from "./evidence-plane-controls.js"
import { buildEvidencePlaneLayout } from "./evidence-plane-layout.js"
import { buildEvidencePlaneOverview } from "./evidence-plane-overview.js"
import { buildEvidencePlaneProjection } from "./evidence-plane-projection.js"

export { EvidencePlaneViewModel } from "../../../contracts/evidence/plane-presentation.js"

export const emptyEvidencePlaneViewModel = ({
  complete
}: {
  readonly complete: boolean
}): EvidencePlaneViewModel =>
  buildEvidencePlaneViewModel({
    complete,
    filter: defaultEvidencePlanePreferences.filter,
    meta: null,
    order: defaultEvidencePlanePreferences.order,
    sectionKey: null,
    sections: [],
    summary: null
  })

const evidencePlaneViewModelFromProjection = ({
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
}): EvidencePlaneViewModel =>
  evidencePlaneViewModelFromProjection({
    complete,
    filter,
    meta,
    order,
    sectionKey,
    sections,
    summary
  })
