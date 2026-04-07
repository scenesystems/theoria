import { Match } from "effect"

import type { CanonicalFrame } from "../../../contracts/canonical-step.js"
import type { EvidenceSection } from "../../../contracts/evidence.js"
import { isWorkflowComparisonSurfaceRunPlan } from "../../../contracts/run-plan.js"
import type { WorkflowComparisonRunPlan } from "../../../contracts/workflow/comparison-run.js"
import { type WorkflowComparisonOption, workflowComparisonOptionForId } from "../../../contracts/workflow/comparison.js"
import { runPhase, type RunState } from "../../state/types.js"

import {
  type WorkflowComparisonGraphViewModel,
  workflowComparisonGraphViewModel
} from "./workflow-comparison-graph-model.js"
import {
  type WorkflowComparisonProgressViewModel,
  workflowComparisonProgressViewModel
} from "./workflow-comparison-progress-model.js"
import {
  type WorkflowComparisonRenderedPreviewViewModel,
  workflowComparisonRenderedPreviewViewModel
} from "./workflow-comparison-rendered-preview-model.js"
import {
  type WorkflowComparisonTranscriptViewModel,
  workflowComparisonTranscriptViewModel
} from "./workflow-comparison-transcript-model.js"

export type WorkflowComparisonSurfaceViewModel = {
  readonly plan: WorkflowComparisonRunPlan
  readonly selection: WorkflowComparisonOption
  readonly selectionLocked: boolean
  readonly phaseLabel: string
  readonly phaseDetail: string
  readonly progress: WorkflowComparisonProgressViewModel
  readonly runStory: string
  readonly graph: WorkflowComparisonGraphViewModel
  readonly transcript: WorkflowComparisonTranscriptViewModel
  readonly renderedPreview: WorkflowComparisonRenderedPreviewViewModel
}

const workflowComparisonPlanFromRun = (run: RunState): WorkflowComparisonRunPlan | null =>
  isWorkflowComparisonSurfaceRunPlan(run.session.runPlan) ? run.session.runPlan : null

const runStory = (plan: WorkflowComparisonRunPlan): string =>
  !plan.optimize
    ? "baseline -> authored optimized replay"
    : plan.comparisonMode === "authored-optimized"
    ? "baseline -> study -> authored optimized replay"
    : "baseline -> study -> search winner replay"

const phaseLabel = (run: RunState): string =>
  Match.value(runPhase(run)).pipe(
    Match.when("idle", () => "Idle"),
    Match.when("running", () => "Running"),
    Match.when("paused", () => "Paused"),
    Match.when("stopping", () => "Stopping"),
    Match.when("failed", () => "Failed"),
    Match.when("success", () => "Succeeded"),
    Match.exhaustive
  )

const phaseDetail = ({
  plan,
  run
}: {
  readonly plan: WorkflowComparisonRunPlan
  readonly run: RunState
}): string =>
  Match.value(runPhase(run)).pipe(
    Match.when("idle", () =>
      workflowComparisonPlanFromRun(run) === null
        ? "Select a proving scenario, then freeze one run plan on the shared runtime seam."
        : "The frozen run plan remains inspectable until reset restores scenario selection."),
    Match.when("running", () =>
      "Canonical graph frames and evidence sections are streaming from one server-authored execution."),
    Match.when("paused", () =>
      "The run authority is paused without handing graph or score truth back to local state."),
    Match.when("stopping", () => "The active run is being interrupted at the shared runtime seam."),
    Match.when("failed", () => "The current execution failed before the success gate sealed the authoritative ledger."),
    Match.when("success", () => `The completed run sealed ${runStory(plan)} on one canonical ledger.`),
    Match.exhaustive
  )

export const workflowComparisonSurfaceViewModel = ({
  draftPlan,
  frame,
  run,
  sections
}: {
  readonly draftPlan: WorkflowComparisonRunPlan
  readonly frame: CanonicalFrame | null
  readonly run: RunState
  readonly sections: ReadonlyArray<EvidenceSection>
}): WorkflowComparisonSurfaceViewModel => {
  const plan = workflowComparisonPlanFromRun(run) ?? draftPlan
  const graph = workflowComparisonGraphViewModel({ frame, sections })
  const transcript = workflowComparisonTranscriptViewModel({ frame, sections })

  return {
    plan,
    selection: workflowComparisonOptionForId(plan.comparisonId),
    selectionLocked: workflowComparisonPlanFromRun(run) !== null,
    phaseLabel: phaseLabel(run),
    phaseDetail: phaseDetail({ plan, run }),
    progress: workflowComparisonProgressViewModel({ plan, sections }),
    runStory: runStory(plan),
    graph,
    transcript,
    renderedPreview: workflowComparisonRenderedPreviewViewModel({ graph, plan, transcript })
  }
}
