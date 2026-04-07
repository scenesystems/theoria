import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import {
  type WorkflowComparisonSurfaceViewModel,
  workflowComparisonSurfaceViewModel
} from "../view/deep/workflow-comparison-surface-model.js"

import { surfaceCanonicalFrameAtom, surfaceEvidenceSectionsAtom, surfaceRunStateAtom } from "./surface.js"
import { workflowComparisonDraftRunPlanAtom } from "./workflow-comparison.js"

const workflowComparisonSurfaceId = "workflow-comparison"

export const workflowComparisonSurfaceViewModelAtom: AtomType.Atom<WorkflowComparisonSurfaceViewModel> = Atom.make(
  (get: AtomType.Context) => {
    const run = get(surfaceRunStateAtom(workflowComparisonSurfaceId))

    return workflowComparisonSurfaceViewModel({
      draftPlan: get(workflowComparisonDraftRunPlanAtom),
      frame: get(surfaceCanonicalFrameAtom(workflowComparisonSurfaceId)),
      run,
      sections: get(surfaceEvidenceSectionsAtom(workflowComparisonSurfaceId))
    })
  }
)
