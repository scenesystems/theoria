import { Schema } from "effect"

export const WorkflowCanvasMode = Schema.Literal("setup", "results")

export type WorkflowCanvasMode = typeof WorkflowCanvasMode.Type

export const WorkflowInspectorPanel = Schema.Literal("source", "evidence", "diagnostics", "result-detail")

export type WorkflowInspectorPanel = typeof WorkflowInspectorPanel.Type

export class WorkflowWorkspaceState extends Schema.Class<WorkflowWorkspaceState>("WorkflowWorkspaceState")({
  activeCanvasMode: WorkflowCanvasMode,
  activeInspectorPanel: WorkflowInspectorPanel
}) {}

export const makeInitialWorkflowWorkspaceState = (): WorkflowWorkspaceState =>
  WorkflowWorkspaceState.make({
    activeCanvasMode: "setup",
    activeInspectorPanel: "source"
  })
