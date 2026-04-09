import { Match, Schema } from "effect"

import { type EntryDraft, isWorkflowEntryDraft } from "../../../../contracts/entry/registry.js"
import type { EvidenceSection } from "../../../../contracts/evidence/item.js"
import type { CanonicalFrame } from "../../../../contracts/study/workflow/canonical-step.js"
import {
  workflowScenarioOptionForId,
  WorkflowScenarioOptionSchema
} from "../../../../contracts/study/workflow/scenario.js"
import {
  WorkflowEntrySelection,
  type WorkflowEntrySelection as WorkflowEntrySelectionModel
} from "../../../../contracts/study/workflow/selection.js"
import {
  workflowRunStory,
  type WorkflowSurfacePhase,
  workflowSurfacePhaseDetail,
  workflowSurfacePhaseLabel
} from "../../../../contracts/study/workflow/surface-phase-presentation.js"
import type { RunState } from "../../../state/run/types.js"
import { WorkflowEvidenceProjection } from "../../../state/workflow/workflow-evidence.js"

import { WorkflowGraphViewModel } from "./graph-model.js"
import { WorkflowProgressViewModel } from "./progress-model.js"
import { WorkflowRenderedPreviewViewModel } from "./rendered-preview-model.js"
import { WorkflowTranscriptViewModel } from "./transcript-model.js"

export class WorkflowSurfaceViewModel extends Schema.Class<WorkflowSurfaceViewModel>("WorkflowSurfaceViewModel")({
  graph: WorkflowGraphViewModel,
  phaseDetail: Schema.String,
  phaseLabel: Schema.String,
  plan: WorkflowEntrySelection,
  progress: WorkflowProgressViewModel,
  renderedPreview: WorkflowRenderedPreviewViewModel,
  runStory: Schema.String,
  selection: WorkflowScenarioOptionSchema,
  selectionLocked: Schema.Boolean,
  transcript: WorkflowTranscriptViewModel
}) {
  static project({
    draftPlan,
    frame,
    run,
    sections
  }: {
    readonly draftPlan: WorkflowEntrySelectionModel
    readonly frame: CanonicalFrame | null
    readonly run: RunState
    readonly sections: ReadonlyArray<EvidenceSection>
  }): WorkflowSurfaceViewModel {
    const planFromRun = workflowPlanFromRun(run)
    const plan = planFromRun ?? draftPlan
    const evidence = WorkflowEvidenceProjection.project(sections)
    const graph = WorkflowGraphViewModel.project({ evidence, frame })
    const transcript = WorkflowTranscriptViewModel.project({ evidence, frame })
    const phase = workflowSurfacePhase(run)
    const runStory = workflowRunStory({
      optimize: plan.controls.optimize,
      targetMode: plan.controls.targetMode
    })

    return WorkflowSurfaceViewModel.make({
      plan,
      selection: workflowScenarioOptionForId(plan.seedId),
      selectionLocked: planFromRun !== null,
      phaseLabel: workflowSurfacePhaseLabel(phase),
      phaseDetail: workflowSurfacePhaseDetail({
        hasFrozenSelection: planFromRun !== null,
        optimize: plan.controls.optimize,
        phase,
        targetMode: plan.controls.targetMode
      }),
      progress: WorkflowProgressViewModel.project({ evidence, plan }),
      runStory,
      graph,
      transcript,
      renderedPreview: WorkflowRenderedPreviewViewModel.project({ graph, plan, transcript })
    })
  }
}

const workflowSurfacePhase = (run: RunState): WorkflowSurfacePhase =>
  Match.value(run).pipe(
    Match.withReturnType<WorkflowSurfacePhase>(),
    Match.tag("RunIdle", () => "idle"),
    Match.tag("RunRunning", ({ session }) =>
      Match.value(session.control).pipe(
        Match.withReturnType<WorkflowSurfacePhase>(),
        Match.when("running", () => "running"),
        Match.when("paused", () => "paused"),
        Match.when("stopping", () => "stopping"),
        Match.exhaustive
      )),
    Match.tag("RunFailed", () => "failed"),
    Match.tag("RunSuccess", () => "succeeded"),
    Match.exhaustive
  )

const workflowEntrySelectionFromDraft = (draft: EntryDraft | null): WorkflowEntrySelectionModel | null =>
  draft !== null && isWorkflowEntryDraft(draft) ? draft : null

const workflowPlanFromRun = (run: RunState): WorkflowEntrySelectionModel | null =>
  workflowEntrySelectionFromDraft(run.session.draft)
