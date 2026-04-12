import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { workflowRichnessEmptyText } from "../../../../contracts/study/workflow/surface-richness-presentation.js"
import {
  selectWorkflowExecutionLaneAtom,
  selectWorkflowOptimizeAtom,
  selectWorkflowRuntimeProfileAtom,
  selectWorkflowSeedAtom,
  selectWorkflowSurfaceProfileAtom,
  selectWorkflowTargetModeAtom
} from "../../../atoms/workflow/draft-actions.js"
import { workflowSurfaceViewModelAtom } from "../../../atoms/workflow/surface-view-model.js"
import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { WorkflowControlsGrid } from "./WorkflowControlsGrid.js"
import { WorkflowPlanSummary } from "./WorkflowPlanSummary.js"
import { WorkflowRichness } from "./WorkflowRichness.js"
import { WorkflowScenarioSelector } from "./WorkflowScenarioSelector.js"

export const WorkflowControl = () => {
  const viewModel = useAtomValue(workflowSurfaceViewModelAtom)
  const selectWorkflowSeed = useAtomSet(selectWorkflowSeedAtom)
  const selectTargetMode = useAtomSet(selectWorkflowTargetModeAtom)
  const selectExecutionLane = useAtomSet(selectWorkflowExecutionLaneAtom)
  const selectOptimize = useAtomSet(selectWorkflowOptimizeAtom)
  const selectRuntimeProfile = useAtomSet(selectWorkflowRuntimeProfileAtom)
  const selectSurfaceProfile = useAtomSet(selectWorkflowSurfaceProfileAtom)
  const selector = viewModel.selector

  return (
    <Stack className="max-w-4xl gap-4 py-2">
      <WorkflowScenarioSelector
        onSelectSeed={selectWorkflowSeed}
        selector={selector}
      />

      <WorkflowControlsGrid
        onSelectTargetMode={selectTargetMode}
        onSelectExecutionLane={selectExecutionLane}
        onSelectOptimize={selectOptimize}
        onSelectRuntimeProfile={selectRuntimeProfile}
        onSelectSurfaceProfile={selectSurfaceProfile}
        selectionLocked={selector.locked}
        viewModel={viewModel}
      />

      {selector.locked
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
