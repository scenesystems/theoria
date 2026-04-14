import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import { workflowEntryId } from "../../../contracts/entry/id.js"
import { type ProgramSourceScope } from "../../../contracts/presentation/program.js"
import { controlRunAtom } from "../../atoms/run/control-actions.js"
import { surfaceRunLifecycleDiagnosticsViewModelAtom } from "../../atoms/run/diagnostics.js"
import { presentedRunAtom } from "../../atoms/run/presented-run.js"
import { selectProgramFileAtom, selectProgramSourceScopeAtom } from "../../atoms/surface/program-source-actions.js"
import { surfaceViewModelAtom, viewModelKey } from "../../atoms/surface/view-model.js"
import {
  selectWorkflowExecutionLaneAtom,
  selectWorkflowOptimizeAtom,
  selectWorkflowRuntimeProfileAtom,
  selectWorkflowSeedAtom,
  selectWorkflowSurfaceProfileAtom,
  selectWorkflowTargetModeAtom
} from "../../atoms/workflow/draft-actions.js"
import { workflowSurfaceViewModelAtom } from "../../atoms/workflow/surface-view-model.js"
import {
  setWorkflowCanvasModeAtom,
  setWorkflowInspectorPanelAtom,
  workflowWorkspaceHandoffDraftAtom,
  workflowWorkspaceResultsAvailableAtom,
  workflowWorkspaceStateAtom
} from "../../atoms/workflow/workflow-workspace.js"
import { Badge } from "../../ui/components/feedback/Badge.js"
import { WorkflowJourneyWorkspace } from "../../ui/components/workflow/WorkflowJourneyWorkspace.js"

import { WorkflowWorkspaceActionBar } from "./components/WorkflowWorkspaceActionBar.js"
import { WorkflowWorkspaceCanvas } from "./components/WorkflowWorkspaceCanvas.js"
import { WorkflowWorkspaceInspectorPane } from "./components/WorkflowWorkspaceInspectorPane.js"

type WorkflowPhaseBadgeTone = "attention" | "danger" | "neutral" | "positive"

const workflowPhaseBadgeTone = (phase: string): WorkflowPhaseBadgeTone =>
  Match.value(phase).pipe(
    Match.withReturnType<WorkflowPhaseBadgeTone>(),
    Match.when("Succeeded", () => "positive"),
    Match.when("Failed", () => "danger"),
    Match.when("Running", () => "attention"),
    Match.when("Paused", () => "attention"),
    Match.when("Stopping", () => "attention"),
    Match.orElse(() => "neutral")
  )

export const WorkflowWorkspace = () => {
  const workflowViewModel = useAtomValue(workflowSurfaceViewModelAtom)
  const surfaceViewModel = useAtomValue(surfaceViewModelAtom(viewModelKey(workflowEntryId, "expanded")))
  const diagnostics = useAtomValue(surfaceRunLifecycleDiagnosticsViewModelAtom(workflowEntryId))
  const handoffDraft = useAtomValue(workflowWorkspaceHandoffDraftAtom)
  const presentedRun = useAtomValue(presentedRunAtom(workflowEntryId))
  const resultsAvailable = useAtomValue(workflowWorkspaceResultsAvailableAtom)
  const workspaceState = useAtomValue(workflowWorkspaceStateAtom)
  const dispatchRunControl = useAtomSet(controlRunAtom)
  const selectProgramFile = useAtomSet(selectProgramFileAtom)
  const selectProgramSourceScope = useAtomSet(selectProgramSourceScopeAtom)
  const selectWorkflowCanvasMode = useAtomSet(setWorkflowCanvasModeAtom)
  const selectWorkflowExecutionLane = useAtomSet(selectWorkflowExecutionLaneAtom)
  const selectWorkflowInspectorPanel = useAtomSet(setWorkflowInspectorPanelAtom)
  const selectWorkflowOptimize = useAtomSet(selectWorkflowOptimizeAtom)
  const selectWorkflowRuntimeProfile = useAtomSet(selectWorkflowRuntimeProfileAtom)
  const selectWorkflowSeed = useAtomSet(selectWorkflowSeedAtom)
  const selectWorkflowSurfaceProfile = useAtomSet(selectWorkflowSurfaceProfileAtom)
  const selectWorkflowTargetMode = useAtomSet(selectWorkflowTargetModeAtom)

  if (surfaceViewModel === null) {
    return null
  }

  return (
    <WorkflowJourneyWorkspace
      actionBar={
        <WorkflowWorkspaceActionBar
          activeCanvasMode={workspaceState.activeCanvasMode}
          activeInspectorPanel={workspaceState.activeInspectorPanel}
          onCanvasModeChange={selectWorkflowCanvasMode}
          onInspectorPanelChange={selectWorkflowInspectorPanel}
          onRunControlAction={(action) => {
            dispatchRunControl({ action, id: workflowEntryId })
          }}
          resultsAvailable={resultsAvailable}
          runControls={surfaceViewModel.runControls}
        />
      }
      actions={
        <Badge tone={workflowPhaseBadgeTone(workflowViewModel.phaseLabel)}>{workflowViewModel.phaseLabel}</Badge>
      }
      canvas={
        <WorkflowWorkspaceCanvas
          activeCanvasMode={workspaceState.activeCanvasMode}
          handoffDraft={handoffDraft}
          onSelectExecutionLane={selectWorkflowExecutionLane}
          onSelectOptimize={selectWorkflowOptimize}
          onSelectRuntimeProfile={selectWorkflowRuntimeProfile}
          onSelectSeed={selectWorkflowSeed}
          onSelectSurfaceProfile={selectWorkflowSurfaceProfile}
          onSelectTargetMode={selectWorkflowTargetMode}
          resultsAvailable={resultsAvailable}
          surfaceViewModel={surfaceViewModel}
          workflowViewModel={workflowViewModel}
        />
      }
      inspector={
        <WorkflowWorkspaceInspectorPane
          activeInspectorPanel={workspaceState.activeInspectorPanel}
          diagnostics={diagnostics}
          onSelectFile={(fileIndex) => {
            selectProgramFile({ fileIndex, id: workflowEntryId })
          }}
          onSelectSourceScope={(scope: ProgramSourceScope) => {
            selectProgramSourceScope({ id: workflowEntryId, scope })
          }}
          presentedRun={presentedRun}
          surfaceViewModel={surfaceViewModel}
          workflowViewModel={workflowViewModel}
        />
      }
      label="Workflow workspace"
      statusItems={[workflowViewModel.runStory, workflowViewModel.selector.selected.label, surfaceViewModel.status]}
      summary="Shape and read one continuous workflow journey: carried trace context above, bounded run control in the middle, and contextual proof on the right."
      title="Workflow journey workspace"
    />
  )
}
