import { Schema } from "effect"

export const WorkflowExecutionLaneSchema = Schema.Literal("deterministic-fallback", "provider")

export type WorkflowExecutionLane = Schema.Schema.Type<typeof WorkflowExecutionLaneSchema>

export const workflowExecutionLanes: ReadonlyArray<WorkflowExecutionLane> = [
  "deterministic-fallback",
  "provider"
]

export const WorkflowTargetModeSchema = Schema.Literal(
  "authored-optimized",
  "search-winner"
)

export type WorkflowTargetMode = Schema.Schema.Type<typeof WorkflowTargetModeSchema>

export const workflowTargetModes: ReadonlyArray<WorkflowTargetMode> = [
  "authored-optimized",
  "search-winner"
]

export const WorkflowRuntimeProfileSchema = Schema.Literal("authored", "preferred", "fastest")

export type WorkflowRuntimeProfile = Schema.Schema.Type<typeof WorkflowRuntimeProfileSchema>

export const workflowRuntimeProfiles: ReadonlyArray<WorkflowRuntimeProfile> = [
  "authored",
  "preferred",
  "fastest"
]

export const WorkflowSurfaceProfileSchema = Schema.Literal("authored", "sidebar", "full-panel")

export type WorkflowSurfaceProfile = Schema.Schema.Type<typeof WorkflowSurfaceProfileSchema>

export const workflowSurfaceProfiles: ReadonlyArray<WorkflowSurfaceProfile> = [
  "authored",
  "sidebar",
  "full-panel"
]

export const WorkflowRunControls = Schema.Struct({
  lane: WorkflowExecutionLaneSchema,
  optimize: Schema.Boolean,
  targetMode: WorkflowTargetModeSchema,
  runtimeProfile: WorkflowRuntimeProfileSchema,
  surfaceProfile: WorkflowSurfaceProfileSchema
})

export type WorkflowRunControls = typeof WorkflowRunControls.Type

type WorkflowRunControlOverrides = {
  readonly targetMode?: WorkflowTargetMode
  readonly lane?: WorkflowExecutionLane
  readonly optimize?: boolean
  readonly runtimeProfile?: WorkflowRuntimeProfile
  readonly surfaceProfile?: WorkflowSurfaceProfile
}

export const defaultWorkflowEntryControls = WorkflowRunControls.make({
  lane: workflowExecutionLanes[0] ?? "deterministic-fallback",
  optimize: true,
  targetMode: "search-winner",
  runtimeProfile: "authored",
  surfaceProfile: "authored"
})

export const workflowExecutionLaneLabel = (
  lane: WorkflowExecutionLane
): string =>
  lane === "deterministic-fallback"
    ? "Deterministic Proof Fallback"
    : "Live Provider Runtime"

export const workflowTargetModeLabel = (
  targetMode: WorkflowTargetMode
): string => targetMode === "authored-optimized" ? "Authored Optimized" : "Search Winner"

export const workflowOptimizeLabel = (optimize: boolean): string =>
  optimize ? "Optimization Study On" : "Optimization Study Off"

export const workflowRuntimeProfileLabel = (
  runtimeProfile: WorkflowRuntimeProfile
): string =>
  runtimeProfile === "authored"
    ? "Authored Default"
    : runtimeProfile === "preferred"
    ? "Preferred Runtime"
    : "Fastest Runtime"

export const workflowSurfaceProfileLabel = (
  surfaceProfile: WorkflowSurfaceProfile
): string =>
  surfaceProfile === "authored"
    ? "Authored Default"
    : surfaceProfile === "sidebar"
    ? "Sidebar"
    : "Full Panel"

export const effectiveWorkflowTargetMode = ({
  targetMode,
  optimize
}: {
  readonly targetMode: WorkflowTargetMode
  readonly optimize: boolean
}): WorkflowTargetMode =>
  !optimize && targetMode === "search-winner"
    ? "authored-optimized"
    : targetMode

export const normalizeWorkflowEntryControls = ({
  targetMode = defaultWorkflowEntryControls.targetMode,
  lane = defaultWorkflowEntryControls.lane,
  optimize = defaultWorkflowEntryControls.optimize,
  runtimeProfile = defaultWorkflowEntryControls.runtimeProfile,
  surfaceProfile = defaultWorkflowEntryControls.surfaceProfile
}: WorkflowRunControlOverrides = {}): WorkflowRunControls =>
  WorkflowRunControls.make({
    lane,
    optimize,
    targetMode: effectiveWorkflowTargetMode({ targetMode, optimize }),
    runtimeProfile,
    surfaceProfile
  })
