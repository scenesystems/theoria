/**
 * Replay-safe record joining workflow session, graph, projection, and
 * evaluation truth.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { EvaluationContractSchema } from "./EvaluationContract.js"
import { GraphExecutionManifestSchema } from "./GraphExecutionManifest.js"
import { GraphExecutionProjectionSchema } from "./GraphExecutionProjection.js"
import { SessionManifestSchema } from "./SessionManifest.js"
import { WorkflowKindSchema } from "./WorkflowKind.js"

/**
 * Replay-safe workflow record for one task or chat execution family.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowExecutionRecordSchema = Schema.Struct({
  recordId: Schema.String,
  workflowKind: WorkflowKindSchema,
  session: SessionManifestSchema,
  graph: GraphExecutionManifestSchema,
  projection: GraphExecutionProjectionSchema,
  evaluation: EvaluationContractSchema
})

/**
 * Workflow-record type extracted from {@link WorkflowExecutionRecordSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowExecutionRecord = Schema.Schema.Type<typeof WorkflowExecutionRecordSchema>
