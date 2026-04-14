import { describe, expect, it } from "@effect/vitest"

import { makeInitialWorkflowWorkspaceState, WorkflowWorkspaceState } from "../../app/contracts/presentation/workflow.js"
import { initialSurfaceState } from "../../app/web/state/surface/state.js"
import {
  workflowResultsAvailable,
  workflowWorkspaceStateForCanvasMode,
  workflowWorkspaceStateForInspectorPanel,
  workflowWorkspaceStateForResultsAvailability
} from "../../app/web/state/workflow/workflow-workspace-state.js"
import { programPreviewFixture } from "../helpers/entry-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"

describe("workflow workspace state", () => {
  it("defaults workflow arrival to setup and keeps inspector focus compatible with the active canvas", () => {
    const arrival = makeInitialWorkflowWorkspaceState()

    expect(arrival.activeCanvasMode).toBe("setup")
    expect(arrival.activeInspectorPanel).toBe("source")
    expect(workflowResultsAvailable({ evidenceSectionCount: 0, run: initialSurfaceState("workflow").run })).toBe(false)
    expect(
      workflowResultsAvailable({
        evidenceSectionCount: 0,
        run: runningRunState({ program: programPreviewFixture.program })
      })
    ).toBe(true)
    expect(workflowResultsAvailable({ evidenceSectionCount: 1, run: initialSurfaceState("workflow").run })).toBe(
      true
    )

    const blockedResults = workflowWorkspaceStateForCanvasMode({
      canvasMode: "results",
      resultsAvailable: false,
      state: arrival
    })
    const blockedResultDetail = workflowWorkspaceStateForInspectorPanel({
      panel: "result-detail",
      resultsAvailable: false,
      state: arrival
    })
    const resultsState = workflowWorkspaceStateForCanvasMode({
      canvasMode: "results",
      resultsAvailable: true,
      state: arrival
    })
    const resultDetailState = workflowWorkspaceStateForInspectorPanel({
      panel: "result-detail",
      resultsAvailable: true,
      state: resultsState
    })
    const reconciledSetupState = workflowWorkspaceStateForResultsAvailability({
      resultsAvailable: false,
      state: WorkflowWorkspaceState.make({
        activeCanvasMode: "results",
        activeInspectorPanel: "result-detail"
      })
    })

    expect(blockedResults.activeCanvasMode).toBe("setup")
    expect(blockedResults.activeInspectorPanel).toBe("source")
    expect(blockedResultDetail.activeCanvasMode).toBe("setup")
    expect(blockedResultDetail.activeInspectorPanel).toBe("source")
    expect(resultsState.activeCanvasMode).toBe("results")
    expect(resultsState.activeInspectorPanel).toBe("source")
    expect(resultDetailState.activeCanvasMode).toBe("results")
    expect(resultDetailState.activeInspectorPanel).toBe("result-detail")
    expect(reconciledSetupState.activeCanvasMode).toBe("setup")
    expect(reconciledSetupState.activeInspectorPanel).toBe("source")
  })
})
