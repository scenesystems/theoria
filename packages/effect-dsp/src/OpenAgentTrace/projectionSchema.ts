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
import {
  OpenAgentTraceContentDigest,
  OpenAgentTraceCoverage,
  OpenAgentTraceEventId,
  OpenAgentTraceRecord,
  OpenAgentTraceSessionId
} from "./schema.js"

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
}) {}

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
}) {}

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

/**
 * Payload-level lineage shared by every persisted trace-derived artifact.
 *
 * @since 0.2.0
 * @category models
 */
export class ArtifactLineage extends Schema.Class<ArtifactLineage>("OpenAgentTrace/ArtifactLineage")({
  sourceDatasetId: Schema.String,
  sourceDatasetRevision: Schema.String,
  sourceSplit: Schema.String,
  sourceRowKey: OpenAgentTraceSessionId,
  sourceSessionId: OpenAgentTraceSessionId,
  sourceFileName: Schema.String,
  adapterId: Schema.String,
  adapterVersion: Schema.String,
  normalizationVersion: Schema.String,
  sourceDigest: OpenAgentTraceContentDigest,
  normalizedDigest: OpenAgentTraceContentDigest,
  redactedDigest: OpenAgentTraceContentDigest,
  reviewStatusDigest: OpenAgentTraceContentDigest
}) {}

/**
 * Extension lineage for workflow-record projections.
 *
 * @since 0.2.0
 * @category models
 */
export class WorkflowProjectionLineage
  extends Schema.Class<WorkflowProjectionLineage>("OpenAgentTrace/WorkflowProjectionLineage")({
    projectionKind: Schema.Literal("workflow-record"),
    projectionVersion: Schema.String,
    workflowRecordId: Schema.String,
    workflowRecordDigest: OpenAgentTraceContentDigest,
    graphManifestDigest: OpenAgentTraceContentDigest,
    evaluationContractDigest: OpenAgentTraceContentDigest
  })
{}

/**
 * Extension lineage for optimization-ready example projections.
 *
 * @since 0.2.0
 * @category models
 */
export class ExampleProjectionLineage
  extends Schema.Class<ExampleProjectionLineage>("OpenAgentTrace/ExampleProjectionLineage")({
    projectionKind: Schema.Literal("example-set"),
    projectionVersion: Schema.String,
    exampleSetDigest: OpenAgentTraceContentDigest,
    exampleCount: Schema.Number,
    objectiveSurfaceId: Schema.String
  })
{}

/**
 * Persisted normalized-record payload carried through `ArtifactEnvelope.Custom`.
 *
 * @since 0.2.0
 * @category models
 */
export class RecordArtifact extends Schema.Class<RecordArtifact>("OpenAgentTrace/RecordArtifact")({
  artifactKind: Schema.Literal("open-agent-trace-record"),
  lineage: ArtifactLineage,
  record: OpenAgentTraceRecord
}) {}

/**
 * Persisted workflow-projection payload carried through `ArtifactEnvelope.Custom`.
 *
 * @since 0.2.0
 * @category models
 */
export class WorkflowProjectionArtifact
  extends Schema.Class<WorkflowProjectionArtifact>("OpenAgentTrace/WorkflowProjectionArtifact")({
    artifactKind: Schema.Literal("open-agent-trace-workflow-projection"),
    lineage: ArtifactLineage,
    projectionLineage: WorkflowProjectionLineage,
    projection: WorkflowProjection
  })
{}

/**
 * Persisted example-projection payload carried through `ArtifactEnvelope.Custom`.
 *
 * @since 0.2.0
 * @category models
 */
export class ExampleProjectionArtifact
  extends Schema.Class<ExampleProjectionArtifact>("OpenAgentTrace/ExampleProjectionArtifact")({
    artifactKind: Schema.Literal("open-agent-trace-example-projection"),
    lineage: ArtifactLineage,
    projectionLineage: ExampleProjectionLineage,
    projection: ExampleProjection
  })
{}

/**
 * Persisted artifact payload union for the experimental corpus lane.
 *
 * @since 0.2.0
 * @category schemas
 */
export const ArtifactPayload = Schema.Union(
  RecordArtifact,
  WorkflowProjectionArtifact,
  ExampleProjectionArtifact
)
