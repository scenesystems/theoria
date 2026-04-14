/**
 * Workflow-family discriminants for reusable graph and session execution.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

/**
 * Released workflow families for reusable task, chat, retrieval, and
 * render-sensitive execution.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowKindSchema = Schema.Literal(
  "task-first",
  "chat-continuation",
  "retrieval-required",
  "render-sensitive"
)

/**
 * Workflow-family discriminator extracted from {@link WorkflowKindSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowKind = Schema.Schema.Type<typeof WorkflowKindSchema>
