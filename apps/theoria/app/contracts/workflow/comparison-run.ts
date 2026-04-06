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

export const WorkflowComparisonExecutionLaneSchema = Schema.Literal("deterministic-fallback")

export type WorkflowComparisonExecutionLane = Schema.Schema.Type<typeof WorkflowComparisonExecutionLaneSchema>

export const workflowComparisonExecutionLanes: ReadonlyArray<WorkflowComparisonExecutionLane> = [
  "deterministic-fallback"
]

export const WorkflowComparisonRunPlan = Schema.Struct({
  consumerId: Schema.Literal("workflow-comparison"),
  comparisonId: WorkflowComparisonIdSchema,
  lane: WorkflowComparisonExecutionLaneSchema
})

export type WorkflowComparisonRunPlan = typeof WorkflowComparisonRunPlan.Type

export const WorkflowComparisonRunRequest = Schema.Struct({
  runToken: RunToken,
  plan: WorkflowComparisonRunPlan
})

export type WorkflowComparisonRunRequest = typeof WorkflowComparisonRunRequest.Type

export const WorkflowComparisonRunIdentity = Schema.Struct({
  consumerId: Schema.Literal("workflow-comparison"),
  comparisonId: WorkflowComparisonIdSchema,
  lane: WorkflowComparisonExecutionLaneSchema,
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
      runToken: request.runToken,
      planFingerprint,
      requestFingerprint
    }))
  )

export const fingerprintWorkflowComparisonSelection = (
  comparisonId: WorkflowComparisonId,
  lane: WorkflowComparisonExecutionLane
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf({ comparisonId, lane })

export { workflowComparisonFingerprint }
