import { Effect, Schema } from "effect"
import { FieldRecord, ModuleId, WorkflowModuleGraphProjection } from "effect-dsp/contracts"
import {
  GraphVariantSchema,
  NodeExecutionContractSchema,
  RuntimeEvidenceSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import { defaultWorkflowComparisonId, type WorkflowComparisonId, WorkflowComparisonIdSchema } from "./manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export type WorkflowEntryManifestSurface = {
  readonly title: string
  readonly description: string
}

export type WorkflowEntryBoundedControlOption<Value extends boolean | string = boolean | string> = {
  readonly value: Value
  readonly label: string
}

export type WorkflowEntryBoundedControlSurface<
  Key extends keyof WorkflowComparisonRunControls & string,
  Value extends WorkflowComparisonRunControls[Key] = WorkflowComparisonRunControls[Key]
> = {
  readonly key: Key
  readonly kind: "boolean" | "enum"
  readonly title: string
  readonly description: string
  readonly options: ReadonlyArray<WorkflowEntryBoundedControlOption<Value>>
}

export const WorkflowComparisonExecutionLaneSchema = Schema.Literal("deterministic-fallback", "provider")

export type WorkflowComparisonExecutionLane = Schema.Schema.Type<typeof WorkflowComparisonExecutionLaneSchema>

export const workflowComparisonExecutionLanes: ReadonlyArray<WorkflowComparisonExecutionLane> = [
  "deterministic-fallback",
  "provider"
]

export const WorkflowComparisonComparisonModeSchema = Schema.Literal(
  "authored-optimized",
  "search-winner"
)

export type WorkflowComparisonComparisonMode = Schema.Schema.Type<typeof WorkflowComparisonComparisonModeSchema>

export const workflowComparisonComparisonModes: ReadonlyArray<WorkflowComparisonComparisonMode> = [
  "authored-optimized",
  "search-winner"
]

export const WorkflowComparisonRuntimeProfileSchema = Schema.Literal("authored", "preferred", "fastest")

export type WorkflowComparisonRuntimeProfile = Schema.Schema.Type<typeof WorkflowComparisonRuntimeProfileSchema>

export const workflowComparisonRuntimeProfiles: ReadonlyArray<WorkflowComparisonRuntimeProfile> = [
  "authored",
  "preferred",
  "fastest"
]

export const WorkflowComparisonSurfaceProfileSchema = Schema.Literal("authored", "sidebar", "full-panel")

export type WorkflowComparisonSurfaceProfile = Schema.Schema.Type<typeof WorkflowComparisonSurfaceProfileSchema>

export const workflowComparisonSurfaceProfiles: ReadonlyArray<WorkflowComparisonSurfaceProfile> = [
  "authored",
  "sidebar",
  "full-panel"
]

export const WorkflowComparisonRunControls = Schema.Struct({
  lane: WorkflowComparisonExecutionLaneSchema,
  optimize: Schema.Boolean,
  comparisonMode: WorkflowComparisonComparisonModeSchema,
  runtimeProfile: WorkflowComparisonRuntimeProfileSchema,
  surfaceProfile: WorkflowComparisonSurfaceProfileSchema
})

export type WorkflowComparisonRunControls = typeof WorkflowComparisonRunControls.Type

export type WorkflowEntrySeedSelection = {
  readonly seedId: WorkflowComparisonId
  readonly controls: WorkflowComparisonRunControls
}

export const defaultWorkflowEntryControls: WorkflowComparisonRunControls = {
  lane: workflowComparisonExecutionLanes[0] ?? "deterministic-fallback",
  optimize: true,
  comparisonMode: "search-winner",
  runtimeProfile: "authored",
  surfaceProfile: "authored"
}

export const workflowComparisonExecutionLaneLabel = (
  lane: WorkflowComparisonExecutionLane
): string =>
  lane === "deterministic-fallback"
    ? "Deterministic Proof Fallback"
    : "Live Provider Runtime"

export const workflowComparisonComparisonModeLabel = (
  comparisonMode: WorkflowComparisonComparisonMode
): string => comparisonMode === "authored-optimized" ? "Authored Optimized" : "Search Winner"

export const workflowComparisonOptimizeLabel = (optimize: boolean): string =>
  optimize ? "Optimization Study On" : "Optimization Study Off"

export const workflowComparisonRuntimeProfileLabel = (
  runtimeProfile: WorkflowComparisonRuntimeProfile
): string =>
  runtimeProfile === "authored"
    ? "Authored Default"
    : runtimeProfile === "preferred"
    ? "Preferred Runtime"
    : "Fastest Runtime"

export const workflowComparisonSurfaceProfileLabel = (
  surfaceProfile: WorkflowComparisonSurfaceProfile
): string =>
  surfaceProfile === "authored"
    ? "Authored Default"
    : surfaceProfile === "sidebar"
    ? "Sidebar"
    : "Full Panel"

export const workflowEntryManifestSurface: WorkflowEntryManifestSurface = {
  title: "Workflow Scenario",
  description:
    "Freeze one workflow seed before running. The server executes baseline, study, and optimized phases on one canonical ledger while the browser projects the resulting graph and evidence stream."
}

export const workflowEntryControlsSurface: ReadonlyArray<
  WorkflowEntryBoundedControlSurface<keyof WorkflowComparisonRunControls & string>
> = [
  {
    key: "lane",
    kind: "enum",
    title: "Execution Lane",
    description:
      "Freeze the server execution lane as part of the entry draft rather than inferring it at request time.",
    options: workflowComparisonExecutionLanes.map((lane) => ({
      value: lane,
      label: workflowComparisonExecutionLaneLabel(lane)
    }))
  },
  {
    key: "optimize",
    kind: "boolean",
    title: "Optimization Study",
    description:
      "Decide whether the frozen entry draft opens the search-study lane or replays only the authored optimized target.",
    options: [true, false].map((optimize) => ({
      value: optimize,
      label: workflowComparisonOptimizeLabel(optimize)
    }))
  },
  {
    key: "comparisonMode",
    kind: "enum",
    title: "Comparison Target",
    description:
      "Freeze whether the final comparison targets the authored optimized replay or the search-study winner.",
    options: workflowComparisonComparisonModes.map((comparisonMode) => ({
      value: comparisonMode,
      label: workflowComparisonComparisonModeLabel(comparisonMode)
    }))
  },
  {
    key: "runtimeProfile",
    kind: "enum",
    title: "Runtime Profile",
    description:
      "Freeze the runtime preference that search and replay are allowed to use when the graph exposes runtime-profile knobs.",
    options: workflowComparisonRuntimeProfiles.map((runtimeProfile) => ({
      value: runtimeProfile,
      label: workflowComparisonRuntimeProfileLabel(runtimeProfile)
    }))
  },
  {
    key: "surfaceProfile",
    kind: "enum",
    title: "Surface Profile",
    description:
      "Freeze the render-surface preference that the graph and render-evaluation lane should honor when a surface-profile knob is available.",
    options: workflowComparisonSurfaceProfiles.map((surfaceProfile) => ({
      value: surfaceProfile,
      label: workflowComparisonSurfaceProfileLabel(surfaceProfile)
    }))
  }
]

export const effectiveWorkflowComparisonMode = ({
  comparisonMode,
  optimize
}: {
  readonly comparisonMode: WorkflowComparisonComparisonMode
  readonly optimize: boolean
}): WorkflowComparisonComparisonMode =>
  !optimize && comparisonMode === "search-winner"
    ? "authored-optimized"
    : comparisonMode

export const makeWorkflowEntryControls = ({
  comparisonMode = defaultWorkflowEntryControls.comparisonMode,
  lane = defaultWorkflowEntryControls.lane,
  optimize = defaultWorkflowEntryControls.optimize,
  runtimeProfile = defaultWorkflowEntryControls.runtimeProfile,
  surfaceProfile = defaultWorkflowEntryControls.surfaceProfile
}: {
  readonly comparisonMode?: WorkflowComparisonComparisonMode
  readonly lane?: WorkflowComparisonExecutionLane
  readonly optimize?: boolean
  readonly runtimeProfile?: WorkflowComparisonRuntimeProfile
  readonly surfaceProfile?: WorkflowComparisonSurfaceProfile
} = {}): WorkflowComparisonRunControls => ({
  lane,
  optimize,
  comparisonMode: effectiveWorkflowComparisonMode({ comparisonMode, optimize }),
  runtimeProfile,
  surfaceProfile
})

export const makeWorkflowEntrySelection = ({
  controls,
  seedId = defaultWorkflowComparisonId
}: {
  readonly controls?: WorkflowComparisonRunControls
  readonly seedId?: WorkflowComparisonId
} = {}): WorkflowEntrySeedSelection => ({
  seedId,
  controls: controls ?? defaultWorkflowEntryControls
})

export class WorkflowComparisonExecutionError extends Schema.TaggedError<WorkflowComparisonExecutionError>()(
  "WorkflowComparisonExecutionError",
  {
    code: Schema.Literal("invalid-query", "execution-failed"),
    message: Schema.String,
    retryable: Schema.Boolean
  }
) {}

export const validateWorkflowEntrySelection = <Selection extends WorkflowEntrySeedSelection>(
  selection: Selection
): Effect.Effect<Selection, WorkflowComparisonExecutionError, never> =>
  !selection.controls.optimize && selection.controls.comparisonMode === "search-winner"
    ? Effect.fail(
      new WorkflowComparisonExecutionError({
        code: "invalid-query",
        message: "Workflow comparison comparisonMode=search-winner requires optimize=true.",
        retryable: false
      })
    )
    : Effect.succeed(selection)

export const workflowEntrySelectionUsesOptimization = (selection: WorkflowEntrySeedSelection): boolean =>
  selection.controls.optimize

export const workflowEntrySelectionUsesSearchWinner = (selection: WorkflowEntrySeedSelection): boolean =>
  selection.controls.optimize && selection.controls.comparisonMode === "search-winner"

export const WorkflowComparisonTraceUsage = Schema.Struct({
  inputTokens: Schema.NullOr(Schema.Number),
  outputTokens: Schema.NullOr(Schema.Number),
  cached: Schema.Boolean
})

export type WorkflowComparisonTraceUsage = typeof WorkflowComparisonTraceUsage.Type

export const WorkflowComparisonTraceProjection = Schema.Struct({
  moduleId: ModuleId,
  signatureDescription: Schema.String,
  input: FieldRecord,
  prompt: Schema.String,
  output: FieldRecord,
  score: Schema.NullOr(Schema.Number),
  rawResponse: Schema.String,
  usage: WorkflowComparisonTraceUsage,
  totalTokens: Schema.Number,
  durationMs: Schema.Number,
  timestamp: Schema.Number
})

export type WorkflowComparisonTraceProjection = typeof WorkflowComparisonTraceProjection.Type

export const WorkflowComparisonNodeExecution = Schema.Struct({
  variant: GraphVariantSchema,
  node: NodeExecutionContractSchema,
  lineage: Schema.Array(NonEmptyString),
  stepIndex: PositiveInt,
  stepCount: PositiveInt,
  outputText: NonEmptyString,
  trace: WorkflowComparisonTraceProjection,
  runtimeEvidence: RuntimeEvidenceSchema
})

export type WorkflowComparisonNodeExecution = typeof WorkflowComparisonNodeExecution.Type

export const WorkflowComparisonVariantExecution = Schema.Struct({
  variant: GraphVariantSchema,
  record: WorkflowExecutionRecordSchema,
  report: WorkflowEvaluationReportSchema,
  graphProjection: WorkflowModuleGraphProjection,
  nodeExecutions: Schema.NonEmptyArray(WorkflowComparisonNodeExecution)
})

export type WorkflowComparisonVariantExecution = typeof WorkflowComparisonVariantExecution.Type

export const WorkflowComparisonSelectionFingerprint = Schema.Struct({
  seedId: WorkflowComparisonIdSchema,
  controls: WorkflowComparisonRunControls,
  workflowKind: WorkflowKindSchema
})

export type WorkflowComparisonSelectionFingerprint = typeof WorkflowComparisonSelectionFingerprint.Type
