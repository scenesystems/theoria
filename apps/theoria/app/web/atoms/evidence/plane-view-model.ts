import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { EvidencePlaneViewModel } from "../../../contracts/evidence/plane-presentation.js"
import { buildEvidencePlaneViewModel } from "../../../contracts/evidence/plane-view-model.js"
import { type RunEvidenceViewModel, runEvidenceViewModel } from "../../../contracts/presentation/run-evidence.js"
import { runEvidencePresentationInput } from "../../view/deep/run-evidence-input.js"

import {
  surfaceEvidenceCompleteAtom,
  surfaceEvidenceMetaAtom,
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStreamAtom,
  surfaceEvidenceSummaryAtom
} from "../surface/evidence-store.js"
import { surfaceRunStateAtom } from "../surface/state.js"
import { surfaceEvidencePlaneAtom } from "./plane.js"

type DeepDiveEvidenceAtomViewModel = RunEvidenceViewModel & {
  readonly plane: EvidencePlaneViewModel
}

export const deepDiveEvidenceAtom: (id: EntryId) => AtomType.Atom<DeepDiveEvidenceAtomViewModel> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      const stream = get(surfaceEvidenceStreamAtom(id))
      const plane = get(surfaceEvidencePlaneAtom(id))

      return {
        ...runEvidenceViewModel(runEvidencePresentationInput({ run, stream })),
        plane: buildEvidencePlaneViewModel({
          complete: get(surfaceEvidenceCompleteAtom(id)),
          filter: plane.filter,
          meta: get(surfaceEvidenceMetaAtom(id)),
          order: plane.order,
          sections: get(surfaceEvidenceSectionsAtom(id)),
          sectionKey: plane.sectionKey,
          summary: get(surfaceEvidenceSummaryAtom(id))
        })
      }
    })
)
