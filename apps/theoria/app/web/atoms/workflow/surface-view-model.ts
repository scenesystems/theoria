import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import { workflowEntryId } from "../../../contracts/entry/id.js"
import { WorkflowSurfaceViewModel } from "../../../contracts/study/workflow/surface-presentation.js"
import { workflowSurfacePresentationInput } from "../../state/workflow/surface-presentation-input.js"

import { surfaceEvidenceSectionsAtom } from "../surface/evidence-store.js"
import { surfaceCanonicalFrameAtom, surfaceDraftAtom, surfaceRunStateAtom } from "../surface/state.js"
import { workflowCatalogAtom } from "./catalog.js"

export const workflowSurfaceViewModelAtom: AtomType.Atom<WorkflowSurfaceViewModel> = Atom.make(
  (get: AtomType.Context) =>
    WorkflowSurfaceViewModel.project(
      workflowSurfacePresentationInput({
        catalog: get(workflowCatalogAtom),
        draft: get(surfaceDraftAtom(workflowEntryId)),
        frame: get(surfaceCanonicalFrameAtom(workflowEntryId)),
        run: get(surfaceRunStateAtom(workflowEntryId)),
        sections: get(surfaceEvidenceSectionsAtom(workflowEntryId))
      })
    )
)
