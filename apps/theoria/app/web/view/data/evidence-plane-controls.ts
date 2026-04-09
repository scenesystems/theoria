import {
  EvidencePlaneControlsViewModel,
  type EvidencePlaneSectionOption
} from "../../../contracts/evidence/plane-presentation.js"
import type { EvidencePlaneFilter, EvidencePlaneOrder } from "../../../contracts/evidence/plane.js"

import { evidencePlaneFilterOptions, evidencePlaneOrderOptions } from "./evidence-plane-ordering.js"

export { EvidencePlaneControlsViewModel } from "../../../contracts/evidence/plane-presentation.js"

const activeOptionIndex = <A>(options: ReadonlyArray<{ readonly value: A }>, value: A): number =>
  Math.max(options.findIndex((option) => option.value === value), 0)

export const buildEvidencePlaneControls = ({
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
