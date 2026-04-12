import { Schema } from "effect"

import type { CanonicalFrame } from "./canonical-step.js"
import { WorkflowScenarioManifest } from "./manifest.js"
import {
  WorkflowEntryBoundedControlSurface,
  WorkflowEntryManifestSurface,
  WorkflowEntrySelection
} from "./selection.js"
import { type WorkflowGraphEvidenceProjection, WorkflowGraphViewModel } from "./surface-graph-presentation.js"
import {
  workflowRunStory,
  type WorkflowSurfacePhase,
  workflowSurfacePhaseDetail,
  workflowSurfacePhaseLabel
} from "./surface-phase-presentation.js"
import { type WorkflowProgressEvidenceProjection, WorkflowProgressViewModel } from "./surface-progress-presentation.js"
import { WorkflowRenderedPreviewViewModel } from "./surface-rendered-preview-presentation.js"
import { type WorkflowTranscriptEvidenceProjection, WorkflowTranscriptViewModel } from "./view-presentation.js"

export type WorkflowSurfaceSnapshot = {
  readonly frame: CanonicalFrame | null
  readonly graphEvidence: WorkflowGraphEvidenceProjection
  readonly phase: WorkflowSurfacePhase
  readonly plan: WorkflowEntrySelection
  readonly progressEvidence: WorkflowProgressEvidenceProjection
  readonly selectionLocked: boolean
  readonly transcriptEvidence: WorkflowTranscriptEvidenceProjection
}

export class WorkflowScenarioSelectorViewModel extends Schema.Class<WorkflowScenarioSelectorViewModel>(
  "WorkflowScenarioSelectorViewModel"
)({
  locked: Schema.Boolean,
  options: Schema.Array(WorkflowScenarioManifest),
  selected: WorkflowScenarioManifest,
  surface: WorkflowEntryManifestSurface
}) {}

export class WorkflowSurfaceViewModel extends Schema.Class<WorkflowSurfaceViewModel>("WorkflowSurfaceViewModel")({
  executionLaneControl: WorkflowEntryBoundedControlSurface,
  graph: WorkflowGraphViewModel,
  optimizeControl: WorkflowEntryBoundedControlSurface,
  phaseDetail: Schema.String,
  phaseLabel: Schema.String,
  plan: WorkflowEntrySelection,
  progress: WorkflowProgressViewModel,
  renderedPreview: WorkflowRenderedPreviewViewModel,
  runtimeProfileControl: WorkflowEntryBoundedControlSurface,
  runStory: Schema.String,
  selector: WorkflowScenarioSelectorViewModel,
  surfaceProfileControl: WorkflowEntryBoundedControlSurface,
  targetModeControl: WorkflowEntryBoundedControlSurface,
  transcript: WorkflowTranscriptViewModel
}) {
  static project({
    frame,
    graphEvidence,
    phase,
    plan,
    progressEvidence,
    selectionLocked,
    transcriptEvidence
  }: WorkflowSurfaceSnapshot): WorkflowSurfaceViewModel {
    const graph = WorkflowGraphViewModel.project({ evidence: graphEvidence, frame })
    const transcript = WorkflowTranscriptViewModel.project({ evidence: transcriptEvidence, frame })
    const selected = WorkflowScenarioManifest.forId(plan.seedId)
    const runStory = workflowRunStory({
      optimize: plan.controls.optimize,
      targetMode: plan.controls.targetMode
    })

    return WorkflowSurfaceViewModel.make({
      executionLaneControl: WorkflowEntryBoundedControlSurface.forKey("lane"),
      graph,
      optimizeControl: WorkflowEntryBoundedControlSurface.forKey("optimize"),
      phaseDetail: workflowSurfacePhaseDetail({
        hasFrozenSelection: selectionLocked,
        optimize: plan.controls.optimize,
        phase,
        targetMode: plan.controls.targetMode
      }),
      phaseLabel: workflowSurfacePhaseLabel(phase),
      plan,
      progress: WorkflowProgressViewModel.project({ evidence: progressEvidence, plan }),
      renderedPreview: WorkflowRenderedPreviewViewModel.project({ graph, plan, transcript }),
      runtimeProfileControl: WorkflowEntryBoundedControlSurface.forKey("runtimeProfile"),
      runStory,
      selector: WorkflowScenarioSelectorViewModel.make({
        locked: selectionLocked,
        options: WorkflowScenarioManifest.catalog(),
        selected,
        surface: WorkflowEntryManifestSurface.authored()
      }),
      surfaceProfileControl: WorkflowEntryBoundedControlSurface.forKey("surfaceProfile"),
      targetModeControl: WorkflowEntryBoundedControlSurface.forKey("targetMode"),
      transcript
    })
  }
}
