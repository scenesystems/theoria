import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import { workflowEntryId } from "../../../contracts/entry/id.js"
import type { WorkflowEntryDraft } from "../../../contracts/entry/registry.js"
import {
  effectiveWorkflowTargetMode,
  normalizeWorkflowEntryControls,
  type WorkflowExecutionLane,
  type WorkflowRuntimeProfile,
  type WorkflowSurfaceProfile,
  type WorkflowTargetMode
} from "../../../contracts/study/workflow/controls.js"
import type { WorkflowScenarioId } from "../../../contracts/study/workflow/scenario.js"

import { modifySurface } from "../surface/internal.js"

const updateWorkflowDraft = (
  ctx: AtomType.FnContext,
  updateDraft: (draft: WorkflowEntryDraft) => WorkflowEntryDraft
): void => {
  modifySurface(ctx.registry, workflowEntryId, (surface) =>
    surface.draft.entryId !== workflowEntryId
      ? surface
      : {
        ...surface,
        draft: updateDraft(surface.draft)
      })
}

const updateWorkflowControls = (
  ctx: AtomType.FnContext,
  nextControls: (controls: WorkflowEntryDraft["controls"]) => {
    readonly targetMode?: WorkflowTargetMode
    readonly lane?: WorkflowExecutionLane
    readonly optimize?: boolean
    readonly runtimeProfile?: WorkflowRuntimeProfile
    readonly surfaceProfile?: WorkflowSurfaceProfile
  }
): void => {
  updateWorkflowDraft(ctx, (draft) => {
    const controls = nextControls(draft.controls)

    return {
      ...draft,
      controls: normalizeWorkflowEntryControls({
        lane: controls.lane ?? draft.controls.lane,
        optimize: controls.optimize ?? draft.controls.optimize,
        targetMode: controls.targetMode ?? draft.controls.targetMode,
        runtimeProfile: controls.runtimeProfile ?? draft.controls.runtimeProfile,
        surfaceProfile: controls.surfaceProfile ?? draft.controls.surfaceProfile
      })
    }
  })
}

export const selectWorkflowSeedAtom = Atom.fnSync<WorkflowScenarioId>()((seedId, ctx) => {
  updateWorkflowDraft(ctx, (draft) => ({
    ...draft,
    seedId
  }))
})

export const selectWorkflowExecutionLaneAtom = Atom.fnSync<WorkflowExecutionLane>()((lane, ctx) => {
  updateWorkflowControls(ctx, () => ({ lane }))
})

export const selectWorkflowOptimizeAtom = Atom.fnSync<boolean>()((optimize, ctx) => {
  updateWorkflowControls(ctx, (controls) => ({
    optimize,
    targetMode: effectiveWorkflowTargetMode({
      targetMode: controls.targetMode,
      optimize
    })
  }))
})

export const selectWorkflowTargetModeAtom = Atom.fnSync<WorkflowTargetMode>()(
  (targetMode, ctx) => {
    updateWorkflowControls(ctx, (controls) => ({
      targetMode,
      optimize: targetMode === "search-winner" ? true : controls.optimize
    }))
  }
)

export const selectWorkflowRuntimeProfileAtom = Atom.fnSync<WorkflowRuntimeProfile>()(
  (runtimeProfile, ctx) => {
    updateWorkflowControls(ctx, () => ({ runtimeProfile }))
  }
)

export const selectWorkflowSurfaceProfileAtom = Atom.fnSync<WorkflowSurfaceProfile>()(
  (surfaceProfile, ctx) => {
    updateWorkflowControls(ctx, () => ({ surfaceProfile }))
  }
)
