/**
 * Graph-manifest authority for reusable workflow execution.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { NodeExecutionContractSchema } from "./NodeExecutionContract.js"
import { WorkflowKindSchema } from "./WorkflowKind.js"
import { GraphVariantSchema, OptimizationKnobKindSchema, WorkflowEdgeKindSchema } from "./WorkflowVocabulary.js"

/**
 * One released edge in a workflow graph manifest.
 *
 * @since 0.2.0
 * @category schemas
 */
export const GraphExecutionEdgeSchema = Schema.Struct({
  edgeId: Schema.String,
  kind: WorkflowEdgeKindSchema,
  fromNodeId: Schema.String,
  toNodeId: Schema.String
})

/**
 * One explicit optimization knob available to a workflow graph manifest.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OptimizationKnobSchema = Schema.Struct({
  key: Schema.String,
  kind: OptimizationKnobKindSchema,
  choices: Schema.Array(Schema.String)
})

/**
 * Frozen graph manifest for one workflow run, including explicit bounded knobs.
 *
 * @since 0.2.0
 * @category schemas
 */
export const GraphExecutionManifestSchema = Schema.Struct({
  manifestId: Schema.String,
  workflowKind: WorkflowKindSchema,
  variant: GraphVariantSchema,
  nodes: Schema.Array(NodeExecutionContractSchema),
  edges: Schema.Array(GraphExecutionEdgeSchema),
  optimizationKnobs: Schema.Array(OptimizationKnobSchema)
})

/**
 * Graph-manifest type extracted from {@link GraphExecutionManifestSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type GraphExecutionManifest = Schema.Schema.Type<typeof GraphExecutionManifestSchema>

/**
 * Workflow graph edge extracted from {@link GraphExecutionEdgeSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type GraphExecutionEdge = Schema.Schema.Type<typeof GraphExecutionEdgeSchema>

/**
 * Optimization knob extracted from {@link OptimizationKnobSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type OptimizationKnob = Schema.Schema.Type<typeof OptimizationKnobSchema>
