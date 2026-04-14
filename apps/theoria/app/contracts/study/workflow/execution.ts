import { Schema } from "effect"
import { FieldRecord, ModuleId, WorkflowGraphProjection } from "effect-dsp/contracts"
import {
  GraphVariantSchema,
  NodeExecutionContractSchema,
  RuntimeEvidenceSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import { WorkflowRunControls } from "./controls.js"
import { WorkflowSeedIdSchema } from "./manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export class WorkflowStudyExecutionError extends Schema.TaggedError<WorkflowStudyExecutionError>()(
  "WorkflowStudyExecutionError",
  {
    code: Schema.Literal("invalid-query", "execution-failed"),
    message: Schema.String,
    retryable: Schema.Boolean
  }
) {}

export const WorkflowTraceUsage = Schema.Struct({
  inputTokens: Schema.NullOr(Schema.Number),
  outputTokens: Schema.NullOr(Schema.Number),
  cached: Schema.Boolean
})

export type WorkflowTraceUsage = typeof WorkflowTraceUsage.Type

export const WorkflowTraceProjection = Schema.Struct({
  moduleId: ModuleId,
  signatureDescription: Schema.String,
  input: FieldRecord,
  prompt: Schema.String,
  output: FieldRecord,
  score: Schema.NullOr(Schema.Number),
  rawResponse: Schema.String,
  usage: WorkflowTraceUsage,
  totalTokens: Schema.Number,
  durationMs: Schema.Number,
  timestamp: Schema.Number
})

export type WorkflowTraceProjection = typeof WorkflowTraceProjection.Type

export const WorkflowNodeExecution = Schema.Struct({
  variant: GraphVariantSchema,
  node: NodeExecutionContractSchema,
  lineage: Schema.Array(NonEmptyString),
  stepIndex: PositiveInt,
  stepCount: PositiveInt,
  outputText: NonEmptyString,
  trace: WorkflowTraceProjection,
  runtimeEvidence: RuntimeEvidenceSchema
})

export type WorkflowNodeExecution = typeof WorkflowNodeExecution.Type

export const WorkflowVariantExecution = Schema.Struct({
  variant: GraphVariantSchema,
  record: WorkflowExecutionRecordSchema,
  report: WorkflowEvaluationReportSchema,
  graphProjection: WorkflowGraphProjection,
  nodeExecutions: Schema.NonEmptyArray(WorkflowNodeExecution)
})

export type WorkflowVariantExecution = typeof WorkflowVariantExecution.Type

export const WorkflowSelectionFingerprint = Schema.Struct({
  seedId: WorkflowSeedIdSchema,
  controls: WorkflowRunControls,
  workflowKind: WorkflowKindSchema
})

export type WorkflowSelectionFingerprint = typeof WorkflowSelectionFingerprint.Type
