/**
 * Session-state authority for reusable workflow runs.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { WorkflowKindSchema } from "./WorkflowKind.js"

const SessionTurnRoleSchema = Schema.Literal("system", "user", "assistant", "tool")

const WorkflowStateLaneSchema = Schema.Literal(
  "task",
  "context",
  "conversation",
  "retrieval",
  "tool-results",
  "render"
)

const SessionTurnSchema = Schema.Struct({
  turnId: Schema.String,
  role: SessionTurnRoleSchema,
  content: Schema.String
})

const SessionStateLaneSchema = Schema.Struct({
  lane: WorkflowStateLaneSchema,
  entries: Schema.Array(Schema.String)
})

/**
 * Replay-safe session truth for one workflow family and its current state.
 *
 * @since 0.2.0
 * @category schemas
 */
export const SessionManifestSchema = Schema.Struct({
  sessionId: Schema.String,
  workflowKind: WorkflowKindSchema,
  turns: Schema.Array(SessionTurnSchema),
  stateLanes: Schema.Array(SessionStateLaneSchema)
})

/**
 * Session-state type extracted from {@link SessionManifestSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type SessionManifest = Schema.Schema.Type<typeof SessionManifestSchema>
