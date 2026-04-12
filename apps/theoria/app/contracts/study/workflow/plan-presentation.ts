import { Match, Schema } from "effect"

import {
  workflowExecutionLaneLabel,
  workflowOptimizeLabel,
  workflowRuntimeProfileLabel,
  workflowSurfaceProfileLabel,
  workflowTargetModeLabel
} from "./controls.js"
import type { WorkflowEntrySelection } from "./selection.js"

export const WorkflowPlanSummaryMetricSchema = Schema.Literal(
  "execution-lane",
  "optimization",
  "phase",
  "replay-target",
  "run-story",
  "runtime-profile",
  "surface-profile"
)

export type WorkflowPlanSummaryMetric = typeof WorkflowPlanSummaryMetricSchema.Type

export class WorkflowPlanSummaryMetricRow extends Schema.Class<WorkflowPlanSummaryMetricRow>(
  "WorkflowPlanSummaryMetricRow"
)({
  key: WorkflowPlanSummaryMetricSchema,
  label: Schema.String,
  unit: Schema.optional(Schema.String),
  value: Schema.String
}) {}

export const workflowPlanSummaryPhaseDetail = (phaseDetail: string): string => phaseDetail

export const workflowPlanSummaryMetricLabel = (metric: WorkflowPlanSummaryMetric): string =>
  Match.value(metric).pipe(
    Match.when("execution-lane", () => "Execution Lane"),
    Match.when("optimization", () => "Optimization"),
    Match.when("replay-target", () => "Replay Target"),
    Match.when("runtime-profile", () => "Runtime Profile"),
    Match.when("surface-profile", () => "Surface Profile"),
    Match.when("run-story", () => "Run Story"),
    Match.when("phase", () => "Phase"),
    Match.exhaustive
  )

export const workflowPlanSummaryMetricRows = ({
  phaseLabel,
  plan,
  runStory
}: {
  readonly phaseLabel: string
  readonly plan: WorkflowEntrySelection
  readonly runStory: string
}): ReadonlyArray<WorkflowPlanSummaryMetricRow> => [
  WorkflowPlanSummaryMetricRow.make({
    key: "execution-lane",
    label: workflowPlanSummaryMetricLabel("execution-lane"),
    value: workflowExecutionLaneLabel(plan.controls.lane)
  }),
  WorkflowPlanSummaryMetricRow.make({
    key: "optimization",
    label: workflowPlanSummaryMetricLabel("optimization"),
    value: workflowOptimizeLabel(plan.controls.optimize)
  }),
  WorkflowPlanSummaryMetricRow.make({
    key: "replay-target",
    label: workflowPlanSummaryMetricLabel("replay-target"),
    value: workflowTargetModeLabel(plan.controls.targetMode)
  }),
  WorkflowPlanSummaryMetricRow.make({
    key: "runtime-profile",
    label: workflowPlanSummaryMetricLabel("runtime-profile"),
    value: workflowRuntimeProfileLabel(plan.controls.runtimeProfile)
  }),
  WorkflowPlanSummaryMetricRow.make({
    key: "surface-profile",
    label: workflowPlanSummaryMetricLabel("surface-profile"),
    value: workflowSurfaceProfileLabel(plan.controls.surfaceProfile)
  }),
  WorkflowPlanSummaryMetricRow.make({
    key: "run-story",
    label: workflowPlanSummaryMetricLabel("run-story"),
    value: runStory
  }),
  WorkflowPlanSummaryMetricRow.make({
    key: "phase",
    label: workflowPlanSummaryMetricLabel("phase"),
    value: phaseLabel
  })
]
