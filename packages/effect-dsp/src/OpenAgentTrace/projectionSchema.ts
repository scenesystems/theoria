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
export class OpenAgentTraceUsageSample extends Schema.Class<OpenAgentTraceUsageSample>("OpenAgentTraceUsageSample")({
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
export class OpenAgentTracePiUsageProjection
  extends Schema.Class<OpenAgentTracePiUsageProjection>("OpenAgentTracePiUsageProjection")({
    eventId: OpenAgentTraceEventId,
    provider: Schema.optional(Schema.String),
    model: Schema.optional(Schema.String),
    api: Schema.optional(Schema.String),
    stopReason: Schema.optional(Schema.String),
    usage: OpenAgentTraceUsageSample,
    cacheReadTokens: Schema.optional(Schema.Number),
    cacheWriteTokens: Schema.optional(Schema.Number),
    totalTokens: Schema.optional(Schema.Number),
    costUsd: Schema.optional(Schema.Number)
  })
{}

/**
 * Bounded workflow projection over a normalized open-agent-trace record.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceWorkflowProjection
  extends Schema.Class<OpenAgentTraceWorkflowProjection>("OpenAgentTraceWorkflowProjection")({
    projectionKind: Schema.Literal("workflow-record"),
    workflowRecord: WorkflowExecutionRecordSchema,
    coverageGaps: Schema.Array(OpenAgentTraceCoverage),
    usageProvenance: Schema.Array(OpenAgentTracePiUsageProjection)
  })
{}

/**
 * Optimization-ready example projection over a normalized open-agent-trace record.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceExampleProjection
  extends Schema.Class<OpenAgentTraceExampleProjection>("OpenAgentTraceExampleProjection")({
    projectionKind: Schema.Literal("example-set"),
    workflowKind: WorkflowKindSchema,
    optimizationKnobs: Schema.Array(OptimizationKnobSchema),
    examples: Schema.NonEmptyArray(Example),
    comparisonCases: Schema.NonEmptyArray(EvaluationCaseSchema),
    coverageGaps: Schema.Array(OpenAgentTraceCoverage),
    usageProvenance: Schema.Array(OpenAgentTracePiUsageProjection),
    examplesDigest: OpenAgentTraceContentDigest,
    comparisonCasesDigest: OpenAgentTraceContentDigest
  })
{}

/**
 * Projection result union for the experimental corpus lane.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceProjection = Schema.Union(OpenAgentTraceWorkflowProjection, OpenAgentTraceExampleProjection)

/**
 * Decoded projection union for the experimental corpus lane.
 *
 * @since 0.2.0
 * @category type-level
 */
export type OpenAgentTraceProjection = typeof OpenAgentTraceProjection.Type

/**
 * Payload-level lineage shared by every persisted trace-derived artifact.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceArtifactLineage
  extends Schema.Class<OpenAgentTraceArtifactLineage>("OpenAgentTraceArtifactLineage")({
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
  })
{}

/**
 * Extension lineage for workflow-record projections.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceWorkflowProjectionLineage
  extends Schema.Class<OpenAgentTraceWorkflowProjectionLineage>("OpenAgentTraceWorkflowProjectionLineage")({
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
export class OpenAgentTraceExampleProjectionLineage
  extends Schema.Class<OpenAgentTraceExampleProjectionLineage>("OpenAgentTraceExampleProjectionLineage")({
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
export class OpenAgentTraceRecordArtifact
  extends Schema.Class<OpenAgentTraceRecordArtifact>("OpenAgentTraceRecordArtifact")({
    artifactKind: Schema.Literal("open-agent-trace-record"),
    lineage: OpenAgentTraceArtifactLineage,
    record: OpenAgentTraceRecord
  })
{}

/**
 * Persisted workflow-projection payload carried through `ArtifactEnvelope.Custom`.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceWorkflowProjectionArtifact
  extends Schema.Class<OpenAgentTraceWorkflowProjectionArtifact>("OpenAgentTraceWorkflowProjectionArtifact")({
    artifactKind: Schema.Literal("open-agent-trace-workflow-projection"),
    lineage: OpenAgentTraceArtifactLineage,
    projectionLineage: OpenAgentTraceWorkflowProjectionLineage,
    projection: OpenAgentTraceWorkflowProjection
  })
{}

/**
 * Persisted example-projection payload carried through `ArtifactEnvelope.Custom`.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceExampleProjectionArtifact
  extends Schema.Class<OpenAgentTraceExampleProjectionArtifact>("OpenAgentTraceExampleProjectionArtifact")({
    artifactKind: Schema.Literal("open-agent-trace-example-projection"),
    lineage: OpenAgentTraceArtifactLineage,
    projectionLineage: OpenAgentTraceExampleProjectionLineage,
    projection: OpenAgentTraceExampleProjection
  })
{}

/**
 * Persisted artifact payload union for the experimental corpus lane.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceArtifactPayload = Schema.Union(
  OpenAgentTraceRecordArtifact,
  OpenAgentTraceWorkflowProjectionArtifact,
  OpenAgentTraceExampleProjectionArtifact
)
