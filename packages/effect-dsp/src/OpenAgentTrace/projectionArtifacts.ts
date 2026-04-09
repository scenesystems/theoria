/**
 * Persisted artifact carriers and noun-owned envelope projectors for normalized open-agent-trace projections.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"
import type * as SearchContracts from "effect-search/Contracts"

import { projectArtifactEnvelope } from "./artifactProjection.js"
import { ArtifactLineage, ExampleProjectionLineage, WorkflowProjectionLineage } from "./projectionArtifacts/lineage.js"
import { ExampleProjection, WorkflowProjection } from "./projectionSchema.js"
import { OpenAgentTraceRecord } from "./schema.js"

export { ArtifactLineage, ExampleProjectionLineage, WorkflowProjectionLineage } from "./projectionArtifacts/lineage.js"

/**
 * Shared projection-envelope input for persisted open-agent-trace artifacts.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ArtifactEnvelopeProjectionOptions = Readonly<{
  readonly record: OpenAgentTraceRecord
  readonly packageVersion: SearchContracts.PackageVersion
  readonly runId: SearchContracts.RunId
  readonly sequence: number
  readonly emittedAt: Schema.Schema.Type<typeof Schema.DateTimeUtc>
}>

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
}) {
  /**
   * Projects one normalized trace record into the canonical artifact envelope.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(options: ArtifactEnvelopeProjectionOptions) {
    return projectArtifactEnvelope(options)
  }
}

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
    projection: Schema.suspend(() => WorkflowProjection)
  })
{
  /**
   * Projects one workflow projection into the canonical artifact envelope.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(
    options: ArtifactEnvelopeProjectionOptions & {
      readonly projection: WorkflowProjection
    }
  ) {
    return projectArtifactEnvelope(options)
  }
}

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
    projection: Schema.suspend(() => ExampleProjection)
  })
{
  /**
   * Projects one optimization-ready example set into the canonical artifact envelope.
   *
   * @since 0.2.0
   * @category constructors
   */
  static project(
    options: ArtifactEnvelopeProjectionOptions & {
      readonly projection: ExampleProjection
    }
  ) {
    return projectArtifactEnvelope(options)
  }
}

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

/**
 * Decoded artifact payload union for the experimental corpus lane.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ArtifactPayload = typeof ArtifactPayload.Type
