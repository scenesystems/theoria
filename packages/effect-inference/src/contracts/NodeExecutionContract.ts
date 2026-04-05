/**
 * Graph-node execution authority for reusable workflow manifests.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { CapabilityRequirementsSchema } from "./CapabilityRequirements.js"
import { RuntimeRoleSchema } from "./DesiredRuntimeDescriptor.js"

const WorkflowNodeKindSchema = Schema.Literal(
  "planner",
  "drafter",
  "critic",
  "synthesizer",
  "responder",
  "tool",
  "retrieval",
  "chat-handoff",
  "render-evaluator"
)

const WorkflowStateLaneSchema = Schema.Literal(
  "task",
  "context",
  "conversation",
  "retrieval",
  "tool-results",
  "render"
)

const WorkflowLoopPolicySchema = Schema.Literal("single-pass", "bounded-critique", "bounded-retry")

/**
 * Package-owned node contract tying graph roles to runtime-role and capability
 * truth.
 *
 * @since 0.2.0
 * @category schemas
 */
export const NodeExecutionContractSchema = Schema.Struct({
  nodeId: Schema.String,
  nodeKind: WorkflowNodeKindSchema,
  runtimeRole: RuntimeRoleSchema,
  capabilityRequirements: Schema.optional(CapabilityRequirementsSchema),
  inputLanes: Schema.Array(WorkflowStateLaneSchema),
  outputLane: WorkflowStateLaneSchema,
  loopPolicy: WorkflowLoopPolicySchema,
  optimizationKnobRefs: Schema.Array(Schema.String)
})

/**
 * Node-execution type extracted from {@link NodeExecutionContractSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type NodeExecutionContract = Schema.Schema.Type<typeof NodeExecutionContractSchema>
