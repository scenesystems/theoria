import { Match } from "effect"

export type WorkflowRichnessSection = "graph" | "progress" | "rendered-preview" | "transcript"

export type WorkflowRichnessTable = "event-trace" | "selection" | "snapshot" | "transcript"

export type WorkflowRichnessEmptyState = "event-trace" | "selection-locked" | "snapshot" | "transcript"

export const workflowRichnessEmptyText = (kind: WorkflowRichnessEmptyState): string =>
  Match.value(kind).pipe(
    Match.when(
      "event-trace",
      () => "Trial-by-trial decisions will appear here once the optimization run begins."
    ),
    Match.when(
      "selection-locked",
      () => "This run is frozen so the chosen workflow stays stable. Reset if you want to study a different one."
    ),
    Match.when(
      "snapshot",
      () => "Checkpoint facts will appear here once the study records a snapshot you can resume or audit."
    ),
    Match.when(
      "transcript",
      () => "Run the study to capture prompts, outputs, and node-level reasoning here."
    ),
    Match.exhaustive
  )

export const workflowRichnessSectionTitle = (section: WorkflowRichnessSection): string =>
  Match.value(section).pipe(
    Match.when("graph", () => "Workflow Comparison"),
    Match.when("progress", () => "Study Progress"),
    Match.when("rendered-preview", () => "Rendered Replay"),
    Match.when("transcript", () => "Transcript & Outputs"),
    Match.exhaustive
  )

export const workflowRichnessTableLabel = (table: WorkflowRichnessTable): string =>
  Match.value(table).pipe(
    Match.when("event-trace", () => "Trial-by-trial study log"),
    Match.when("selection", () => "Frozen study choices"),
    Match.when("snapshot", () => "Study snapshot facts"),
    Match.when("transcript", () => "Node prompts, outputs, and response evidence"),
    Match.exhaustive
  )
