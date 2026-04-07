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

import { Envelope } from "../envelope.js"
import { DurableFingerprint, fingerprintOf } from "../fingerprint.js"
import { RunData } from "../run.js"
import { workflowComparisonFingerprint, type WorkflowComparisonId, WorkflowComparisonIdSchema } from "./comparison.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const RunToken = Schema.String.pipe(Schema.minLength(1))

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

export type WorkflowComparisonRunPlanControls = {
  readonly lane: WorkflowComparisonExecutionLane
  readonly optimize: boolean
  readonly comparisonMode: WorkflowComparisonComparisonMode
  readonly runtimeProfile: WorkflowComparisonRuntimeProfile
  readonly surfaceProfile: WorkflowComparisonSurfaceProfile
}

export const defaultWorkflowComparisonRunPlanControls: WorkflowComparisonRunPlanControls = {
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
): string => (comparisonMode === "authored-optimized" ? "Authored Optimized" : "Search Winner")

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

export const WorkflowComparisonRunPlan = Schema.Struct({
  consumerId: Schema.Literal("workflow-comparison"),
  comparisonId: WorkflowComparisonIdSchema,
  lane: WorkflowComparisonExecutionLaneSchema,
  optimize: Schema.Boolean,
  comparisonMode: WorkflowComparisonComparisonModeSchema,
  runtimeProfile: WorkflowComparisonRuntimeProfileSchema,
  surfaceProfile: WorkflowComparisonSurfaceProfileSchema
})

export type WorkflowComparisonRunPlan = typeof WorkflowComparisonRunPlan.Type

export const makeWorkflowComparisonRunPlan = ({
  comparisonId,
  comparisonMode = defaultWorkflowComparisonRunPlanControls.comparisonMode,
  lane = defaultWorkflowComparisonRunPlanControls.lane,
  optimize = defaultWorkflowComparisonRunPlanControls.optimize,
  runtimeProfile = defaultWorkflowComparisonRunPlanControls.runtimeProfile,
  surfaceProfile = defaultWorkflowComparisonRunPlanControls.surfaceProfile
}: {
  readonly comparisonId: WorkflowComparisonId
  readonly comparisonMode?: WorkflowComparisonComparisonMode
  readonly lane?: WorkflowComparisonExecutionLane
  readonly optimize?: boolean
  readonly runtimeProfile?: WorkflowComparisonRuntimeProfile
  readonly surfaceProfile?: WorkflowComparisonSurfaceProfile
}): WorkflowComparisonRunPlan => ({
  consumerId: "workflow-comparison",
  comparisonId,
  lane,
  optimize,
  comparisonMode,
  runtimeProfile,
  surfaceProfile
})

export const WorkflowComparisonRunRequest = Schema.Struct({
  runToken: RunToken,
  plan: WorkflowComparisonRunPlan
})

export type WorkflowComparisonRunRequest = typeof WorkflowComparisonRunRequest.Type

export const WorkflowComparisonRunIdentity = Schema.Struct({
  consumerId: Schema.Literal("workflow-comparison"),
  comparisonId: WorkflowComparisonIdSchema,
  lane: WorkflowComparisonExecutionLaneSchema,
  optimize: Schema.Boolean,
  comparisonMode: WorkflowComparisonComparisonModeSchema,
  runtimeProfile: WorkflowComparisonRuntimeProfileSchema,
  surfaceProfile: WorkflowComparisonSurfaceProfileSchema,
  runToken: RunToken,
  planFingerprint: DurableFingerprint,
  requestFingerprint: DurableFingerprint
})

export type WorkflowComparisonRunIdentity = typeof WorkflowComparisonRunIdentity.Type

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

export const WorkflowComparisonRunSuccess = Schema.Struct({
  identity: WorkflowComparisonRunIdentity,
  comparisonFingerprint: DurableFingerprint,
  workflowKind: WorkflowKindSchema,
  baseline: WorkflowComparisonVariantExecution,
  optimized: WorkflowComparisonVariantExecution,
  runData: RunData
})

export type WorkflowComparisonRunSuccess = typeof WorkflowComparisonRunSuccess.Type

export const WorkflowComparisonRunEnvelope = Envelope(WorkflowComparisonRunSuccess)

export type WorkflowComparisonRunEnvelope = typeof WorkflowComparisonRunEnvelope.Type

export class WorkflowComparisonExecutionError extends Schema.TaggedError<WorkflowComparisonExecutionError>()(
  "WorkflowComparisonExecutionError",
  {
    code: Schema.Literal("invalid-query", "execution-failed"),
    message: Schema.String,
    retryable: Schema.Boolean
  }
) {}

const encodeRunPlan = Schema.encodeSync(WorkflowComparisonRunPlan)
const encodeRunRequest = Schema.encodeSync(WorkflowComparisonRunRequest)
const WorkflowComparisonRunRequestJson = Schema.parseJson(WorkflowComparisonRunRequest)

export const encodeWorkflowComparisonRunRequestJson = Schema.encodeSync(WorkflowComparisonRunRequestJson)

export const fingerprintWorkflowComparisonRunPlan = (
  plan: WorkflowComparisonRunPlan
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeRunPlan(plan))

export const fingerprintWorkflowComparisonRunRequest = (
  request: WorkflowComparisonRunRequest
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeRunRequest(request))

export const resolveWorkflowComparisonRunIdentity = (
  request: WorkflowComparisonRunRequest
): Effect.Effect<WorkflowComparisonRunIdentity, never, never> =>
  Effect.all({
    planFingerprint: fingerprintWorkflowComparisonRunPlan(request.plan),
    requestFingerprint: fingerprintWorkflowComparisonRunRequest(request)
  }).pipe(
    Effect.map(({ planFingerprint, requestFingerprint }) => ({
      consumerId: request.plan.consumerId,
      comparisonId: request.plan.comparisonId,
      lane: request.plan.lane,
      optimize: request.plan.optimize,
      comparisonMode: request.plan.comparisonMode,
      runtimeProfile: request.plan.runtimeProfile,
      surfaceProfile: request.plan.surfaceProfile,
      runToken: request.runToken,
      planFingerprint,
      requestFingerprint
    }))
  )

export const fingerprintWorkflowComparisonSelection = (
  plan: WorkflowComparisonRunPlan
): Effect.Effect<typeof DurableFingerprint.Type, never, never> =>
  fingerprintOf({
    comparisonId: plan.comparisonId,
    lane: plan.lane,
    optimize: plan.optimize,
    comparisonMode: plan.comparisonMode,
    runtimeProfile: plan.runtimeProfile,
    surfaceProfile: plan.surfaceProfile
  })

export { workflowComparisonFingerprint }
