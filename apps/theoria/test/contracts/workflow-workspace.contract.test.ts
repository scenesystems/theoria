import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"

import {
  makeInitialWorkflowWorkspaceState,
  WorkflowCanvasMode,
  WorkflowInspectorPanel,
  WorkflowWorkspaceState
} from "../../app/contracts/presentation/workflow.js"

describe("Workflow workspace contracts", () => {
  it("publishes workflow canvas and inspector modes as schema-owned workflow workspace meaning", () => {
    const arrival = makeInitialWorkflowWorkspaceState()

    expect(Schema.is(WorkflowCanvasMode)("setup")).toBe(true)
    expect(Schema.is(WorkflowCanvasMode)("results")).toBe(true)
    expect(Schema.is(WorkflowCanvasMode)("trace")).toBe(false)
    expect(Schema.is(WorkflowInspectorPanel)("source")).toBe(true)
    expect(Schema.is(WorkflowInspectorPanel)("evidence")).toBe(true)
    expect(Schema.is(WorkflowInspectorPanel)("diagnostics")).toBe(true)
    expect(Schema.is(WorkflowInspectorPanel)("result-detail")).toBe(true)
    expect(Schema.is(WorkflowInspectorPanel)("materials")).toBe(false)
    expect(Schema.is(WorkflowWorkspaceState)(arrival)).toBe(true)
    expect(arrival).toEqual(
      WorkflowWorkspaceState.make({
        activeCanvasMode: "setup",
        activeInspectorPanel: "source"
      })
    )
  })
})
