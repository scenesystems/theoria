import { Option, Schema } from "effect"

import { WorkflowHandoffDraft } from "../../presentation/interactions.js"
import type { CanonicalFrame } from "./canonical-step.js"
import { WorkflowCatalogEntry, workflowCatalogEntryForSeedId } from "./catalog.js"
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
  readonly catalog: ReadonlyArray<WorkflowCatalogEntry>
  readonly frame: CanonicalFrame | null
  readonly graphEvidence: WorkflowGraphEvidenceProjection
  readonly handoff: WorkflowHandoffDraft | null
  readonly phase: WorkflowSurfacePhase
  readonly plan: WorkflowEntrySelection
  readonly progressEvidence: WorkflowProgressEvidenceProjection
  readonly selectionLocked: boolean
  readonly transcriptEvidence: WorkflowTranscriptEvidenceProjection
}

const fallbackWorkflowCatalogEntry = (seedId: WorkflowEntrySelection["seedId"]): WorkflowCatalogEntry =>
  WorkflowCatalogEntry.importedFallback(seedId)

export class WorkflowSelectorViewModel extends Schema.Class<WorkflowSelectorViewModel>(
  "WorkflowSelectorViewModel"
)({
  locked: Schema.Boolean,
  options: Schema.Array(WorkflowCatalogEntry),
  selected: WorkflowCatalogEntry,
  surface: WorkflowEntryManifestSurface
}) {}

export class WorkflowSurfaceViewModel extends Schema.Class<WorkflowSurfaceViewModel>("WorkflowSurfaceViewModel")({
  executionLaneControl: WorkflowEntryBoundedControlSurface,
  graph: WorkflowGraphViewModel,
  handoff: Schema.NullOr(WorkflowHandoffDraft),
  optimizeControl: WorkflowEntryBoundedControlSurface,
  phaseDetail: Schema.String,
  phaseLabel: Schema.String,
  plan: WorkflowEntrySelection,
  progress: WorkflowProgressViewModel,
  renderedPreview: WorkflowRenderedPreviewViewModel,
  runtimeProfileControl: WorkflowEntryBoundedControlSurface,
  runStory: Schema.String,
  selector: WorkflowSelectorViewModel,
  surfaceProfileControl: WorkflowEntryBoundedControlSurface,
  targetModeControl: WorkflowEntryBoundedControlSurface,
  transcript: WorkflowTranscriptViewModel
}) {
  static project({
    catalog,
    frame,
    graphEvidence,
    handoff,
    phase,
    plan,
    progressEvidence,
    selectionLocked,
    transcriptEvidence
  }: WorkflowSurfaceSnapshot): WorkflowSurfaceViewModel {
    const graph = WorkflowGraphViewModel.project({ evidence: graphEvidence, frame })
    const transcript = WorkflowTranscriptViewModel.project({ evidence: transcriptEvidence, frame })
    const selected = workflowCatalogEntryForSeedId(catalog, plan.seedId).pipe(
      Option.getOrElse(() => fallbackWorkflowCatalogEntry(plan.seedId))
    )
    const options = workflowCatalogEntryForSeedId(catalog, plan.seedId).pipe(
      Option.match({
        onNone: () => [...catalog, selected],
        onSome: () => catalog
      })
    )
    const runStory = workflowRunStory({
      optimize: plan.controls.optimize,
      targetMode: plan.controls.targetMode
    })

    return WorkflowSurfaceViewModel.make({
      executionLaneControl: WorkflowEntryBoundedControlSurface.forKey("lane"),
      graph,
      handoff,
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
      selector: WorkflowSelectorViewModel.make({
        locked: selectionLocked,
        options,
        selected,
        surface: WorkflowEntryManifestSurface.authored()
      }),
      surfaceProfileControl: WorkflowEntryBoundedControlSurface.forKey("surfaceProfile"),
      targetModeControl: WorkflowEntryBoundedControlSurface.forKey("targetMode"),
      transcript
    })
  }
}
