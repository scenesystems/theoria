/**
 * Projection authority for graph execution views over a frozen workflow
 * manifest.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

const WorkflowStateLaneSchema = Schema.Literal(
  "task",
  "context",
  "conversation",
  "retrieval",
  "tool-results",
  "render"
)

/**
 * Minimal projection shape for graph consumers that need entry, terminal, and
 * active state-lane visibility.
 *
 * @since 0.2.0
 * @category schemas
 */
export const GraphExecutionProjectionSchema = Schema.Struct({
  manifestId: Schema.String,
  entryNodeId: Schema.String,
  terminalNodeIds: Schema.Array(Schema.String),
  activeStateLanes: Schema.Array(WorkflowStateLaneSchema)
})

/**
 * Graph-projection type extracted from {@link GraphExecutionProjectionSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type GraphExecutionProjection = Schema.Schema.Type<typeof GraphExecutionProjectionSchema>
