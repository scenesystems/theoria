import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import {
  defaultWorkflowComparisonRunPlanControls,
  makeWorkflowComparisonRunPlan,
  type WorkflowComparisonComparisonMode,
  type WorkflowComparisonExecutionLane,
  type WorkflowComparisonRunPlan,
  type WorkflowComparisonRuntimeProfile,
  type WorkflowComparisonSurfaceProfile
} from "../../contracts/workflow/comparison-run.js"
import { type WorkflowComparisonId, workflowComparisonIds } from "../../contracts/workflow/comparison.js"

const defaultWorkflowComparisonId: WorkflowComparisonId = workflowComparisonIds[0] ??
  "workflow-comparison/task-briefing"

const effectiveComparisonMode = ({
  comparisonMode,
  optimize
}: {
  readonly comparisonMode: WorkflowComparisonComparisonMode
  readonly optimize: boolean
}): WorkflowComparisonComparisonMode =>
  !optimize && comparisonMode === "search-winner"
    ? "authored-optimized"
    : comparisonMode

export const workflowComparisonSelectionAtom = Atom.make<WorkflowComparisonId>(defaultWorkflowComparisonId).pipe(
  Atom.keepAlive
)

export const workflowComparisonExecutionLaneAtom = Atom.make<WorkflowComparisonExecutionLane>(
  defaultWorkflowComparisonRunPlanControls.lane
).pipe(Atom.keepAlive)

export const workflowComparisonOptimizeAtom = Atom.make<boolean>(
  defaultWorkflowComparisonRunPlanControls.optimize
).pipe(Atom.keepAlive)

export const workflowComparisonComparisonModeAtom = Atom.make<WorkflowComparisonComparisonMode>(
  defaultWorkflowComparisonRunPlanControls.comparisonMode
).pipe(Atom.keepAlive)

export const workflowComparisonRuntimeProfileAtom = Atom.make<WorkflowComparisonRuntimeProfile>(
  defaultWorkflowComparisonRunPlanControls.runtimeProfile
).pipe(Atom.keepAlive)

export const workflowComparisonSurfaceProfileAtom = Atom.make<WorkflowComparisonSurfaceProfile>(
  defaultWorkflowComparisonRunPlanControls.surfaceProfile
).pipe(Atom.keepAlive)

export const selectWorkflowComparisonSelectionAtom = Atom.fnSync<WorkflowComparisonId>()((comparisonId, ctx) => {
  ctx.set(workflowComparisonSelectionAtom, comparisonId)
})

export const selectWorkflowComparisonExecutionLaneAtom = Atom.fnSync<WorkflowComparisonExecutionLane>()((lane, ctx) => {
  ctx.set(workflowComparisonExecutionLaneAtom, lane)
})

export const selectWorkflowComparisonOptimizeAtom = Atom.fnSync<boolean>()((optimize, ctx) => {
  ctx.set(workflowComparisonOptimizeAtom, optimize)
})

export const selectWorkflowComparisonComparisonModeAtom = Atom.fnSync<WorkflowComparisonComparisonMode>()(
  (comparisonMode, ctx) => {
    ctx.set(workflowComparisonComparisonModeAtom, comparisonMode)

    if (comparisonMode === "search-winner") {
      ctx.set(workflowComparisonOptimizeAtom, true)
    }
  }
)

export const selectWorkflowComparisonRuntimeProfileAtom = Atom.fnSync<WorkflowComparisonRuntimeProfile>()(
  (runtimeProfile, ctx) => {
    ctx.set(workflowComparisonRuntimeProfileAtom, runtimeProfile)
  }
)

export const selectWorkflowComparisonSurfaceProfileAtom = Atom.fnSync<WorkflowComparisonSurfaceProfile>()(
  (surfaceProfile, ctx) => {
    ctx.set(workflowComparisonSurfaceProfileAtom, surfaceProfile)
  }
)

export const workflowComparisonDraftRunPlanAtom: AtomType.Atom<WorkflowComparisonRunPlan> = Atom.make(
  (get: AtomType.Context) => {
    const optimize = get(workflowComparisonOptimizeAtom)

    return makeWorkflowComparisonRunPlan({
      comparisonId: get(workflowComparisonSelectionAtom),
      lane: get(workflowComparisonExecutionLaneAtom),
      optimize,
      comparisonMode: effectiveComparisonMode({
        comparisonMode: get(workflowComparisonComparisonModeAtom),
        optimize
      }),
      runtimeProfile: get(workflowComparisonRuntimeProfileAtom),
      surfaceProfile: get(workflowComparisonSurfaceProfileAtom)
    })
  }
)

export type WorkflowComparisonRunPlanOverrides = {
  readonly comparisonMode?: WorkflowComparisonComparisonMode
  readonly lane?: WorkflowComparisonExecutionLane
  readonly optimize?: boolean
  readonly runtimeProfile?: WorkflowComparisonRuntimeProfile
  readonly surfaceProfile?: WorkflowComparisonSurfaceProfile
}

export const workflowComparisonRunPlan = (
  comparisonId: WorkflowComparisonId,
  overrides: WorkflowComparisonRunPlanOverrides = {}
): WorkflowComparisonRunPlan => ({
  ...makeWorkflowComparisonRunPlan({ comparisonId, ...overrides }),
  comparisonMode: effectiveComparisonMode({
    comparisonMode: overrides.comparisonMode ?? defaultWorkflowComparisonRunPlanControls.comparisonMode,
    optimize: overrides.optimize ?? defaultWorkflowComparisonRunPlanControls.optimize
  })
})
