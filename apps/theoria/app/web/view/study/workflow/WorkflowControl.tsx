import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { workflowEntryId } from "../../../../contracts/entry/id.js"
import { defaultWorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import { workflowRichnessEmptyText } from "../../../../contracts/study/workflow/surface-richness-presentation.js"
import { surfaceEvidenceSectionsAtom } from "../../../atoms/surface/evidence-store.js"
import { surfaceCanonicalFrameAtom, surfaceDraftAtom, surfaceRunStateAtom } from "../../../atoms/surface/state.js"
import {
  selectWorkflowExecutionLaneAtom,
  selectWorkflowOptimizeAtom,
  selectWorkflowRuntimeProfileAtom,
  selectWorkflowSeedAtom,
  selectWorkflowSurfaceProfileAtom,
  selectWorkflowTargetModeAtom
} from "../../../atoms/workflow/draft-actions.js"
import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { WorkflowSurfaceViewModel } from "./surface-model.js"
import { WorkflowControlsGrid } from "./WorkflowControlsGrid.js"
import { WorkflowPlanSummary } from "./WorkflowPlanSummary.js"
import { WorkflowRichness } from "./WorkflowRichness.js"
import { WorkflowScenarioSelector } from "./WorkflowScenarioSelector.js"

export const WorkflowControl = () => {
  const draft = useAtomValue(surfaceDraftAtom(workflowEntryId))
  const frame = useAtomValue(surfaceCanonicalFrameAtom(workflowEntryId))
  const run = useAtomValue(surfaceRunStateAtom(workflowEntryId))
  const sections = useAtomValue(surfaceEvidenceSectionsAtom(workflowEntryId))
  const viewModel = WorkflowSurfaceViewModel.project({
    draftPlan: draft.entryId === workflowEntryId ? draft : defaultWorkflowEntrySelection,
    frame,
    run,
    sections
  })
  const selectWorkflowSeed = useAtomSet(selectWorkflowSeedAtom)
  const selectTargetMode = useAtomSet(selectWorkflowTargetModeAtom)
  const selectExecutionLane = useAtomSet(selectWorkflowExecutionLaneAtom)
  const selectOptimize = useAtomSet(selectWorkflowOptimizeAtom)
  const selectRuntimeProfile = useAtomSet(selectWorkflowRuntimeProfileAtom)
  const selectSurfaceProfile = useAtomSet(selectWorkflowSurfaceProfileAtom)
  const selectedOption = viewModel.selection

  return (
    <Stack className="max-w-4xl gap-4 py-2">
      <WorkflowScenarioSelector
        onSelectSeed={selectWorkflowSeed}
        selectedSeedId={selectedOption.id}
        selectionLocked={viewModel.selectionLocked}
      />

      <WorkflowControlsGrid
        onSelectTargetMode={selectTargetMode}
        onSelectExecutionLane={selectExecutionLane}
        onSelectOptimize={selectOptimize}
        onSelectRuntimeProfile={selectRuntimeProfile}
        onSelectSurfaceProfile={selectSurfaceProfile}
        selectionLocked={viewModel.selectionLocked}
        viewModel={viewModel}
      />

      {viewModel.selectionLocked
        ? (
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={workflowRichnessEmptyText("selection-locked")}
            variant="expanded"
          />
        )
        : null}

      <WorkflowPlanSummary viewModel={viewModel} />

      <WorkflowRichness viewModel={viewModel} />
    </Stack>
  )
}
