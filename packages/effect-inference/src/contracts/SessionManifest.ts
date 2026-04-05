/**
 * Session-state authority for reusable workflow runs.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { WorkflowKindSchema } from "./WorkflowKind.js"
import { SessionTurnRoleSchema, WorkflowStateLaneSchema } from "./WorkflowVocabulary.js"

/**
 * One replay-safe turn in a workflow session.
 *
 * @since 0.2.0
 * @category schemas
 */
export const SessionTurnSchema = Schema.Struct({
  turnId: Schema.String,
  role: SessionTurnRoleSchema,
  content: Schema.String
})

/**
 * Entries stored in one released workflow state lane.
 *
 * @since 0.2.0
 * @category schemas
 */
export const SessionStateLaneSchema = Schema.Struct({
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

/**
 * Session turn extracted from {@link SessionTurnSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type SessionTurn = Schema.Schema.Type<typeof SessionTurnSchema>

/**
 * Session state lane extracted from {@link SessionStateLaneSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type SessionStateLane = Schema.Schema.Type<typeof SessionStateLaneSchema>
