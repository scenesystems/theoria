/**
 * Replay-safe Amp thread export snapshot nouns derived from `amp threads export`.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { FieldRecord } from "../../contracts/FieldValue.js"
import { AmpThreadId } from "../amp/captureEvidence.js"

const AmpThreadExportTimestamp = Schema.transform(
  Schema.Union(Schema.String, Schema.Number),
  Schema.String,
  {
    decode: (value) => typeof value === "number" ? String(value) : value,
    encode: (value) => value
  }
)

const AmpThreadTree = Schema.Struct({
  uri: Schema.String,
  displayName: Schema.optional(Schema.String)
})

const AmpThreadTextContent = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
  startTime: Schema.optional(Schema.Number),
  finalTime: Schema.optional(Schema.Number)
})

const AmpThreadThinkingContent = Schema.Struct({
  type: Schema.Literal("thinking"),
  thinking: Schema.String,
  startTime: Schema.optional(Schema.Number),
  finalTime: Schema.optional(Schema.Number)
})

const AmpThreadToolUseContentSchema = Schema.Struct({
  type: Schema.Literal("tool_use"),
  id: Schema.String,
  name: Schema.String,
  input: FieldRecord,
  startTime: Schema.optional(Schema.Number),
  finalTime: Schema.optional(Schema.Number)
})

const AmpThreadToolRun = Schema.Struct({
  status: Schema.Literal("done", "error", "cancelled", "running", "pending"),
  result: Schema.optional(Schema.Unknown)
})

const AmpThreadToolResultContentSchema = Schema.Struct({
  type: Schema.Literal("tool_result"),
  toolUseID: Schema.String,
  run: AmpThreadToolRun,
  startTime: Schema.optional(Schema.Number),
  finalTime: Schema.optional(Schema.Number)
})

/**
 * Union of replay-safe visible Amp thread content blocks.
 *
 * @since 0.2.0
 */
export const AmpThreadContent = Schema.Union(
  AmpThreadTextContent,
  AmpThreadThinkingContent,
  AmpThreadToolUseContentSchema,
  AmpThreadToolResultContentSchema
)

/**
 * One message from an `amp threads export` snapshot.
 *
 * @since 0.2.0
 */
export class AmpThreadMessage extends Schema.Class<AmpThreadMessage>("OpenAgentTrace/AmpThreadMessage")({
  messageId: Schema.Number,
  role: Schema.Literal("user", "assistant"),
  meta: Schema.optional(
    Schema.Struct({
      sentAt: Schema.optional(Schema.Number)
    })
  ),
  content: Schema.Array(AmpThreadContent)
}) {}

/**
 * Replay-safe export snapshot returned by `amp threads export`.
 *
 * @since 0.2.0
 */
export class AmpThreadExportSnapshot
  extends Schema.Class<AmpThreadExportSnapshot>("OpenAgentTrace/AmpThreadExportSnapshot")({
    v: Schema.Number,
    id: AmpThreadId,
    title: Schema.String,
    created: AmpThreadExportTimestamp,
    updatedAt: AmpThreadExportTimestamp,
    agentMode: Schema.optional(Schema.String),
    env: Schema.optional(
      Schema.Struct({
        initial: Schema.Struct({
          trees: Schema.optional(Schema.Array(AmpThreadTree))
        })
      })
    ),
    messages: Schema.NonEmptyArray(AmpThreadMessage)
  })
{}

/**
 * Exported tool-use block shape from `amp threads export` snapshots.
 *
 * @since 0.2.0
 */
export type AmpThreadToolUseContent = typeof AmpThreadToolUseContentSchema.Type

/**
 * Exported tool-result block shape from `amp threads export` snapshots.
 *
 * @since 0.2.0
 */
export type AmpThreadToolResultContent = typeof AmpThreadToolResultContentSchema.Type

/**
 * JSON codec for replay-safe Amp thread export snapshots.
 *
 * @since 0.2.0
 */
export const ExportSnapshotJson = Schema.parseJson(AmpThreadExportSnapshot)

/**
 * Decoder for unknown Amp thread export snapshot input.
 *
 * @since 0.2.0
 */
export const decodeExportSnapshot = Schema.decodeUnknown(AmpThreadExportSnapshot)

/**
 * Static TypeScript view of replay-safe Amp thread content blocks.
 *
 * @since 0.2.0
 */
export type AmpThreadContent = typeof AmpThreadContent.Type
