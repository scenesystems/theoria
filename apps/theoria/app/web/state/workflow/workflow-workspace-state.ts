import {
  type WorkflowCanvasMode,
  type WorkflowInspectorPanel,
  WorkflowWorkspaceState
} from "../../../contracts/presentation/workflow.js"
import type { RunState } from "../run/types.js"

const workflowInspectorPanelsByCanvasMode: Record<WorkflowCanvasMode, ReadonlyArray<WorkflowInspectorPanel>> = {
  setup: ["source", "diagnostics"],
  results: ["source", "evidence", "diagnostics", "result-detail"]
}

const defaultWorkflowInspectorPanelByCanvasMode: Record<WorkflowCanvasMode, WorkflowInspectorPanel> = {
  setup: "source",
  results: "evidence"
}

const workflowCanvasModeForResultsAvailability = ({
  canvasMode,
  resultsAvailable
}: {
  readonly canvasMode: WorkflowCanvasMode
  readonly resultsAvailable: boolean
}): WorkflowCanvasMode => canvasMode === "results" && !resultsAvailable ? "setup" : canvasMode

const workflowInspectorPanelForCanvasMode = ({
  canvasMode,
  panel
}: {
  readonly canvasMode: WorkflowCanvasMode
  readonly panel: WorkflowInspectorPanel
}): WorkflowInspectorPanel =>
  workflowInspectorPanelsByCanvasMode[canvasMode].includes(panel)
    ? panel
    : defaultWorkflowInspectorPanelByCanvasMode[canvasMode]

export const workflowInspectorPanelsForCanvasMode = (
  canvasMode: WorkflowCanvasMode
): ReadonlyArray<WorkflowInspectorPanel> => workflowInspectorPanelsByCanvasMode[canvasMode]

export const workflowResultsAvailable = ({
  evidenceSectionCount,
  run
}: {
  readonly evidenceSectionCount: number
  readonly run: RunState
}): boolean => run._tag !== "RunIdle" || evidenceSectionCount > 0

export const workflowWorkspaceStateForResultsAvailability = ({
  resultsAvailable,
  state
}: {
  readonly resultsAvailable: boolean
  readonly state: WorkflowWorkspaceState
}): WorkflowWorkspaceState => {
  const activeCanvasMode = workflowCanvasModeForResultsAvailability({
    canvasMode: state.activeCanvasMode,
    resultsAvailable
  })

  return WorkflowWorkspaceState.make({
    ...state,
    activeCanvasMode,
    activeInspectorPanel: workflowInspectorPanelForCanvasMode({
      canvasMode: activeCanvasMode,
      panel: state.activeInspectorPanel
    })
  })
}

export const workflowWorkspaceStateForCanvasMode = ({
  canvasMode,
  resultsAvailable,
  state
}: {
  readonly canvasMode: WorkflowCanvasMode
  readonly resultsAvailable: boolean
  readonly state: WorkflowWorkspaceState
}): WorkflowWorkspaceState =>
  workflowWorkspaceStateForResultsAvailability({
    resultsAvailable,
    state: WorkflowWorkspaceState.make({
      ...state,
      activeCanvasMode: canvasMode
    })
  })

export const workflowWorkspaceStateForInspectorPanel = ({
  panel,
  resultsAvailable,
  state
}: {
  readonly panel: WorkflowInspectorPanel
  readonly resultsAvailable: boolean
  readonly state: WorkflowWorkspaceState
}): WorkflowWorkspaceState => {
  const compatibleState = workflowWorkspaceStateForResultsAvailability({ resultsAvailable, state })

  return WorkflowWorkspaceState.make({
    ...compatibleState,
    activeInspectorPanel: workflowInspectorPanelForCanvasMode({
      canvasMode: compatibleState.activeCanvasMode,
      panel
    })
  })
}
