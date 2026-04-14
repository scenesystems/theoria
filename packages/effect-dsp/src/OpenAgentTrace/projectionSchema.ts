/**
 * Projection and artifact schemas for the experimental open-agent-trace lane.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"
import {
  EvaluationCaseSchema,
  OptimizationKnobSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import { Example } from "../Example/index.js"
import type { OpenAgentTraceRecord } from "./schema.js"
import { OpenAgentTraceContentDigest, OpenAgentTraceCoverage, OpenAgentTraceEventId } from "./schema.js"
import {
  projectExamples as projectExamplesInternal,
  projectWorkflow as projectWorkflowInternal
} from "./workflowProjection.js"

/**
 * JSON-safe usage sample preserved on projected assistant turns.
 *
 * @since 0.2.0
 * @category models
 */
export class UsageSample extends Schema.Class<UsageSample>("OpenAgentTrace/UsageSample")({
  inputTokens: Schema.optional(Schema.Number),
  outputTokens: Schema.optional(Schema.Number),
  cached: Schema.Boolean
}) {}

/**
 * Typed assistant-usage provenance preserved from `pi` turns.
 *
 * @since 0.2.0
 * @category models
 */
export class PiUsageProjection extends Schema.Class<PiUsageProjection>("OpenAgentTrace/PiUsageProjection")({
  eventId: OpenAgentTraceEventId,
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  api: Schema.optional(Schema.String),
  stopReason: Schema.optional(Schema.String),
  usage: UsageSample,
  cacheReadTokens: Schema.optional(Schema.Number),
  cacheWriteTokens: Schema.optional(Schema.Number),
  totalTokens: Schema.optional(Schema.Number),
  costUsd: Schema.optional(Schema.Number)
}) {}

/**
 * Bounded workflow projection over a normalized open-agent-trace record.
 *
 * @since 0.2.0
 * @category models
 */
export class WorkflowProjection extends Schema.Class<WorkflowProjection>("OpenAgentTrace/WorkflowProjection")({
  projectionKind: Schema.Literal("workflow-record"),
  workflowRecord: WorkflowExecutionRecordSchema,
  coverageGaps: Schema.Array(OpenAgentTraceCoverage),
  usageProvenance: Schema.Array(PiUsageProjection)
}) {
  /**
   * Projects one normalized open-agent-trace record into the workflow projection noun.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(record: OpenAgentTraceRecord) {
    return projectWorkflowInternal(record)
  }
}

/**
 * Optimization-ready example projection over a normalized open-agent-trace record.
 *
 * @since 0.2.0
 * @category models
 */
export class ExampleProjection extends Schema.Class<ExampleProjection>("OpenAgentTrace/ExampleProjection")({
  projectionKind: Schema.Literal("example-set"),
  workflowKind: WorkflowKindSchema,
  optimizationKnobs: Schema.Array(OptimizationKnobSchema),
  examples: Schema.NonEmptyArray(Example),
  comparisonCases: Schema.NonEmptyArray(EvaluationCaseSchema),
  coverageGaps: Schema.Array(OpenAgentTraceCoverage),
  usageProvenance: Schema.Array(PiUsageProjection),
  examplesDigest: OpenAgentTraceContentDigest,
  comparisonCasesDigest: OpenAgentTraceContentDigest
}) {
  /**
   * Projects one normalized open-agent-trace record into the optimization-ready example noun.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(record: OpenAgentTraceRecord) {
    return projectExamplesInternal(record)
  }
}

/**
 * Projection result union for the experimental corpus lane.
 *
 * @since 0.2.0
 * @category schemas
 */
export const Projection = Schema.Union(WorkflowProjection, ExampleProjection)

/**
 * Decoded projection union for the experimental corpus lane.
 *
 * @since 0.2.0
 * @category type-level
 */
export type Projection = typeof Projection.Type
