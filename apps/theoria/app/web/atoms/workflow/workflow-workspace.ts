import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import { workflowEntryId } from "../../../contracts/entry/id.js"
import type { WorkflowHandoffDraft } from "../../../contracts/presentation/interactions.js"
import type { WorkflowWorkspaceState } from "../../../contracts/presentation/workflow.js"
import {
  makeInitialWorkflowWorkspaceState,
  type WorkflowCanvasMode,
  type WorkflowInspectorPanel
} from "../../../contracts/presentation/workflow.js"
import type { StudyDraft } from "../../../contracts/study/registry.js"
import { WorkflowStudyInput } from "../../../contracts/study/workflow/input.js"
import {
  workflowResultsAvailable,
  workflowWorkspaceStateForCanvasMode,
  workflowWorkspaceStateForInspectorPanel
} from "../../state/workflow/workflow-workspace-state.js"

import { surfaceEvidenceSectionCountAtom } from "../surface/evidence-store.js"
import { surfaceDraftAtom, surfaceRunDraftAtom, surfaceRunStateAtom } from "../surface/state.js"

const workflowStudyInputFromDraft = (draft: StudyDraft | null): WorkflowStudyInput =>
  draft !== null && draft.entryId === workflowEntryId ? draft.input : WorkflowStudyInput.empty()

const updateWorkflowWorkspaceState = (
  ctx: AtomType.FnContext,
  update: (state: WorkflowWorkspaceState) => WorkflowWorkspaceState
): void => {
  ctx.set(workflowWorkspaceStateAtom, update(ctx(workflowWorkspaceStateAtom)))
}

const workflowStudyInputAtom: AtomType.Atom<WorkflowStudyInput> = Atom.make((get: AtomType.Context) =>
  workflowStudyInputFromDraft(get(surfaceRunDraftAtom(workflowEntryId)) ?? get(surfaceDraftAtom(workflowEntryId)))
)

export const workflowWorkspaceStateAtom: AtomType.Writable<WorkflowWorkspaceState> = Atom.make(
  makeInitialWorkflowWorkspaceState()
).pipe(Atom.keepAlive)

export const workflowWorkspaceHandoffDraftAtom: AtomType.Atom<WorkflowHandoffDraft | null> = Atom.make(
  (get: AtomType.Context) => get(workflowStudyInputAtom).handoff
)

export const workflowWorkspaceResultsAvailableAtom: AtomType.Atom<boolean> = Atom.make((get: AtomType.Context) =>
  workflowResultsAvailable({
    evidenceSectionCount: get(surfaceEvidenceSectionCountAtom(workflowEntryId)),
    run: get(surfaceRunStateAtom(workflowEntryId))
  })
)

export const resetWorkflowWorkspaceAtom = Atom.fnSync<void>()((_, ctx) => {
  ctx.set(workflowWorkspaceStateAtom, makeInitialWorkflowWorkspaceState())
})

export const setWorkflowCanvasModeAtom = Atom.fnSync<WorkflowCanvasMode>()((canvasMode, ctx) => {
  updateWorkflowWorkspaceState(ctx, (state) =>
    workflowWorkspaceStateForCanvasMode({
      canvasMode,
      resultsAvailable: ctx(workflowWorkspaceResultsAvailableAtom),
      state
    }))
})

export const setWorkflowInspectorPanelAtom = Atom.fnSync<WorkflowInspectorPanel>()((panel, ctx) => {
  updateWorkflowWorkspaceState(ctx, (state) =>
    workflowWorkspaceStateForInspectorPanel({
      panel,
      resultsAvailable: ctx(workflowWorkspaceResultsAvailableAtom),
      state
    }))
})
