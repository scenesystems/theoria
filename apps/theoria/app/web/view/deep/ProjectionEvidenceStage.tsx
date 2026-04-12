import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import type { EntryId } from "../../../contracts/entry/id.js"
import { deepDiveEvidenceAtom } from "../../atoms/evidence/plane-view-model.js"
import {
  selectEvidencePlaneFilterAtom,
  selectEvidencePlaneOrderAtom,
  selectEvidencePlaneSectionAtom
} from "../../atoms/evidence/plane.js"

import { EvidenceStage } from "./SurfaceStage.js"

export const ProjectionEvidenceStage = ({ id }: { readonly id: EntryId }) => {
  const evidence = useAtomValue(deepDiveEvidenceAtom(id))
  const selectEvidenceFilter = useAtomSet(selectEvidencePlaneFilterAtom)
  const selectEvidenceOrder = useAtomSet(selectEvidencePlaneOrderAtom)
  const selectEvidenceSection = useAtomSet(selectEvidencePlaneSectionAtom)

  return (
    <EvidenceStage
      onSelectEvidenceFilter={(filter) => {
        selectEvidenceFilter({ filter, id })
      }}
      onSelectEvidenceOrder={(order) => {
        selectEvidenceOrder({ id, order })
      }}
      onSelectEvidenceSection={(sectionKey) => {
        selectEvidenceSection({ id, sectionKey })
      }}
      viewModel={evidence}
    />
  )
}
