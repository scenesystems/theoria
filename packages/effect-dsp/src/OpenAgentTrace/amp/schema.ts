/**
 * Raw Amp capture schemas used by the experimental Amp adapter lane.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { FieldRecord } from "../../contracts/FieldValue.js"

const AmpThreadRef = Schema.Struct({ id: Schema.String })
const AmpThreadTextBlock = Schema.Struct({ type: Schema.Literal("text"), text: Schema.String })
const AmpThreadThinkingBlock = Schema.Struct({ type: Schema.Literal("thinking"), thinking: Schema.String })
const AmpThreadToolUseBlock = Schema.Struct({
  type: Schema.Literal("tool_use"),
  id: Schema.String,
  name: Schema.String,
  input: FieldRecord
})
const AmpThreadToolResultBlock = Schema.Struct({
  type: Schema.Literal("tool_result"),
  toolUseID: Schema.String,
  output: Schema.optional(Schema.String),
  status: Schema.Literal("done", "error", "cancelled", "running", "pending")
})

/**
 * Simplified Amp thread message family exposed through the Plugin API.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpPluginThreadMessage = Schema.Union(
  Schema.Struct({
    role: Schema.Literal("user"),
    id: Schema.Number,
    content: Schema.Array(Schema.Union(AmpThreadTextBlock, AmpThreadToolResultBlock))
  }),
  Schema.Struct({
    role: Schema.Literal("assistant"),
    id: Schema.Number,
    content: Schema.Array(Schema.Union(AmpThreadTextBlock, AmpThreadThinkingBlock, AmpThreadToolUseBlock))
  }),
  Schema.Struct({
    role: Schema.Literal("info"),
    id: Schema.Number,
    content: Schema.Array(AmpThreadTextBlock)
  })
)

const AmpPluginSessionStartEvent = Schema.Struct({ thread: Schema.optional(AmpThreadRef) })
const AmpPluginToolCallEvent = Schema.Struct({
  thread: Schema.optional(AmpThreadRef),
  toolUseID: Schema.String,
  tool: Schema.String,
  input: FieldRecord
})
const AmpPluginToolResultEvent = Schema.Struct({
  toolUseID: Schema.String,
  tool: Schema.String,
  input: FieldRecord,
  status: Schema.Literal("done", "error", "cancelled"),
  error: Schema.optional(Schema.String),
  output: Schema.optional(Schema.Unknown)
})
const AmpPluginAgentStartEvent = Schema.Struct({ message: Schema.String, id: Schema.Number })
const AmpPluginAgentEndEvent = Schema.Struct({
  message: Schema.String,
  id: Schema.Number,
  status: Schema.Literal("done", "error", "interrupted"),
  messages: Schema.Array(AmpPluginThreadMessage)
})

/**
 * Timestamped Amp Plugin API tool lifecycle event recorded inside one turn.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpPluginToolEvent = Schema.Union(
  Schema.Struct({ type: Schema.Literal("tool.call"), timestamp: Schema.String, payload: AmpPluginToolCallEvent }),
  Schema.Struct({ type: Schema.Literal("tool.result"), timestamp: Schema.String, payload: AmpPluginToolResultEvent })
)

/**
 * One captured Amp agent turn composed from public Plugin API payloads.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpPluginTurnCapture = Schema.Struct({
  startedAt: Schema.String,
  agentStart: Schema.Struct({ timestamp: Schema.String, payload: AmpPluginAgentStartEvent }),
  events: Schema.Array(AmpPluginToolEvent),
  agentEnd: Schema.Struct({ timestamp: Schema.String, payload: AmpPluginAgentEndEvent })
})

/**
 * Raw Amp Plugin API capture document normalized by the package-owned adapter.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpPluginCapture = Schema.Struct({
  threadId: Schema.String,
  cwd: Schema.String,
  capturedAt: Schema.String,
  sessionStart: Schema.Struct({ timestamp: Schema.String, payload: AmpPluginSessionStartEvent }),
  turns: Schema.NonEmptyArray(AmpPluginTurnCapture)
})

/**
 * Decoded Amp plugin capture type.
 *
 * @since 0.2.0
 * @category type-level
 */
export type AmpPluginCapture = typeof AmpPluginCapture.Type

/**
 * Decoded Amp plugin tool event type.
 *
 * @since 0.2.0
 * @category type-level
 */
export type AmpPluginToolEvent = typeof AmpPluginToolEvent.Type

/**
 * Decoded Amp plugin thread-message type.
 *
 * @since 0.2.0
 * @category type-level
 */
export type AmpPluginThreadMessage = typeof AmpPluginThreadMessage.Type
