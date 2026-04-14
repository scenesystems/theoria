/**
 * Lineage nouns and noun-owned lineage projections for open-agent-trace artifacts.
 *
 * @since 0.2.0
 */
import { digestSchemaValue } from "@scenesystems/digest"
import { Effect, Schema } from "effect"
import {
  EvaluationContractSchema,
  GraphExecutionManifestSchema,
  WorkflowExecutionRecordSchema
} from "effect-inference/Contracts"

import type { ExampleProjection, WorkflowProjection } from "../projectionSchema.js"
import { PROJECTION_VERSION } from "../projectionShared.js"
import { digestRecord } from "../provenance.js"
import {
  decodeOpenAgentTraceContentDigest,
  OpenAgentTraceContentDigest,
  type OpenAgentTraceRecord,
  OpenAgentTraceSessionId
} from "../schema.js"

const ADAPTER_ID = "pi-mono"
const ADAPTER_VERSION = "1"
const NORMALIZATION_VERSION = "1"

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
}) {
  /**
   * Projects canonical payload lineage from one normalized trace record.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(record: OpenAgentTraceRecord) {
    return Effect.map(digestRecord(record), (digests) =>
      ArtifactLineage.make({
        sourceDatasetId: record.source.datasetId,
        sourceDatasetRevision: record.source.datasetRevision,
        sourceSplit: record.source.split,
        sourceRowKey: record.source.rowKey,
        sourceSessionId: record.source.sessionId,
        sourceFileName: record.source.fileName,
        adapterId: ADAPTER_ID,
        adapterVersion: ADAPTER_VERSION,
        normalizationVersion: NORMALIZATION_VERSION,
        sourceDigest: digests.sourceDigest,
        normalizedDigest: digests.normalizedDigest,
        redactedDigest: digests.redactedDigest,
        reviewStatusDigest: digests.reviewStatusDigest
      }))
  }
}

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
{
  /**
   * Projects workflow-specific lineage from one workflow projection.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(projection: WorkflowProjection) {
    return Effect.gen(function*() {
      const workflowRecordDigest = yield* Effect.flatMap(
        digestSchemaValue(WorkflowExecutionRecordSchema, projection.workflowRecord),
        decodeOpenAgentTraceContentDigest
      )
      const graphManifestDigest = yield* Effect.flatMap(
        digestSchemaValue(GraphExecutionManifestSchema, projection.workflowRecord.graph),
        decodeOpenAgentTraceContentDigest
      )
      const evaluationContractDigest = yield* Effect.flatMap(
        digestSchemaValue(EvaluationContractSchema, projection.workflowRecord.evaluation),
        decodeOpenAgentTraceContentDigest
      )

      return WorkflowProjectionLineage.make({
        projectionKind: "workflow-record",
        projectionVersion: PROJECTION_VERSION,
        workflowRecordId: projection.workflowRecord.recordId,
        workflowRecordDigest,
        graphManifestDigest,
        evaluationContractDigest
      })
    })
  }
}

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
{
  /**
   * Projects example-set lineage from one optimization-ready example projection.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(projection: ExampleProjection): ExampleProjectionLineage {
    return ExampleProjectionLineage.make({
      projectionKind: "example-set",
      projectionVersion: PROJECTION_VERSION,
      exampleSetDigest: projection.examplesDigest,
      exampleCount: projection.examples.length,
      objectiveSurfaceId: `open-agent-trace:${projection.workflowKind}:examples`
    })
  }
}
