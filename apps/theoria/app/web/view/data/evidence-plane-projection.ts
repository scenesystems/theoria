import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import { EvidencePlaneProjection } from "../../../contracts/evidence/plane-presentation.js"
import type { EvidencePlaneFilter, EvidencePlaneOrder } from "../../../contracts/evidence/plane.js"

import { buildEvidencePlaneOrdering } from "./evidence-plane-ordering.js"
import { projectEvidenceSections } from "./evidence-section-projection.js"

export { EvidencePlaneProjection } from "../../../contracts/evidence/plane-presentation.js"

export const buildEvidencePlaneProjection = ({
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
