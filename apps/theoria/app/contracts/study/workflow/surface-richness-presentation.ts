import { Match } from "effect"

export type WorkflowRichnessSection = "graph" | "progress" | "rendered-preview" | "transcript"

export type WorkflowRichnessTable = "event-trace" | "selection" | "snapshot" | "transcript"

export type WorkflowRichnessEmptyState = "event-trace" | "selection-locked" | "snapshot" | "transcript"

export const workflowRichnessEmptyText = (kind: WorkflowRichnessEmptyState): string =>
  Match.value(kind).pipe(
    Match.when(
      "event-trace",
      () => "Study event trace rows will stream here as the search lane advances through the bounded trial budget."
    ),
    Match.when(
      "selection-locked",
      () =>
        "This scenario is frozen from the current run session. Reset the run to switch to a different workflow study replay."
    ),
    Match.when(
      "snapshot",
      () => "Snapshot facts appear here once the study has checkpointed a canonical optimization snapshot."
    ),
    Match.when(
      "transcript",
      () => "No transcript rows yet. Run the proving surface to materialize node-level prompts and outputs."
    ),
    Match.exhaustive
  )

export const workflowRichnessSectionTitle = (section: WorkflowRichnessSection): string =>
  Match.value(section).pipe(
    Match.when("graph", () => "Graph Comparison"),
    Match.when("progress", () => "Optimization Progress"),
    Match.when("rendered-preview", () => "Rendered Preview"),
    Match.when("transcript", () => "Transcript Evidence"),
    Match.exhaustive
  )

export const workflowRichnessTableLabel = (table: WorkflowRichnessTable): string =>
  Match.value(table).pipe(
    Match.when("event-trace", () => "Optimization study event trace"),
    Match.when("selection", () => "Frozen optimization selections"),
    Match.when("snapshot", () => "Optimization snapshot facts"),
    Match.when("transcript", () => "Node-level transcript and output evidence"),
    Match.exhaustive
  )
