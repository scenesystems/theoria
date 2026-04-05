/**
 * Graph-manifest authority for reusable workflow execution.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { NodeExecutionContractSchema } from "./NodeExecutionContract.js"
import { WorkflowKindSchema } from "./WorkflowKind.js"

const WorkflowEdgeKindSchema = Schema.Literal(
  "next",
  "branch",
  "feedback",
  "tool-call",
  "retrieval",
  "handoff",
  "render-check"
)

const GraphVariantSchema = Schema.Literal("baseline", "optimized")

const OptimizationKnobKindSchema = Schema.Literal(
  "instruction-profile",
  "runtime-profile",
  "candidate-count",
  "critique-pass-budget",
  "response-length-target",
  "tool-routing",
  "retrieval-depth",
  "node-enabled",
  "surface-profile"
)

const GraphExecutionEdgeSchema = Schema.Struct({
  edgeId: Schema.String,
  kind: WorkflowEdgeKindSchema,
  fromNodeId: Schema.String,
  toNodeId: Schema.String
})

const OptimizationKnobSchema = Schema.Struct({
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
