import { Match } from "effect"

import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import { WorkflowEvidenceProjection } from "../../../contracts/study/workflow/evidence-projection.js"
import { WorkflowEntrySelection } from "../../../contracts/study/workflow/selection.js"
import type { WorkflowSurfacePhase } from "../../../contracts/study/workflow/surface-phase-presentation.js"
import type { WorkflowSurfaceSnapshot } from "../../../contracts/study/workflow/surface-presentation.js"

import type { RunState } from "../run/types.js"

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

const workflowPlanFromRun = (run: RunState) => WorkflowEntrySelection.optionFromEntryDraft(run.session.draft)

export const workflowSurfacePresentationInput = ({
  draft,
  frame,
  run,
  sections
}: {
  readonly draft: EntryDraft | null
  readonly frame: CanonicalFrame | null
  readonly run: RunState
  readonly sections: ReadonlyArray<EvidenceSection>
}): WorkflowSurfaceSnapshot => {
  const evidence = WorkflowEvidenceProjection.project(sections)
  const planFromRun = workflowPlanFromRun(run)
  const plan = planFromRun ?? WorkflowEntrySelection.fromEntryDraftOrDefaults(draft)

  return {
    frame,
    graphEvidence: {
      graphs: evidence.graphs,
      optimizationProgress: evidence.optimizationProgress,
      optimizationSummary: evidence.optimizationSummary,
      optimizationWinner: evidence.optimizationWinner,
      workflowDelta: evidence.workflowDelta
    },
    phase: workflowSurfacePhase(run),
    plan,
    progressEvidence: {
      optimizationProgress: evidence.optimizationProgress,
      optimizationSnapshot: evidence.optimizationSnapshot,
      optimizationStudyEventTrace: evidence.optimizationStudyEventTrace,
      optimizationSummary: evidence.optimizationSummary,
      optimizationWinner: evidence.optimizationWinner,
      workflowDelta: evidence.workflowDelta
    },
    selectionLocked: planFromRun !== null,
    transcriptEvidence: {
      nodeExecutions: evidence.nodeExecutions
    }
  }
}
