/**
 * Core normalized open-agent-trace building blocks.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { FieldRecord } from "../../../contracts/FieldValue.js"
import {
  OpenAgentTraceBlockId,
  OpenAgentTraceContentDigest,
  OpenAgentTraceEventId,
  OpenAgentTraceFindingId,
  OpenAgentTraceRedactionKey,
  OpenAgentTraceSessionId
} from "./authorities.js"

const TextBlock = Schema.Struct({
  type: Schema.Literal("text"),
  blockId: OpenAgentTraceBlockId,
  text: Schema.String,
  redactionRefs: Schema.optional(Schema.Array(OpenAgentTraceFindingId))
})

const ImageBlock = Schema.Struct({
  type: Schema.Literal("image"),
  blockId: OpenAgentTraceBlockId,
  mimeType: Schema.String,
  contentDigest: OpenAgentTraceContentDigest,
  redactionRefs: Schema.optional(Schema.Array(OpenAgentTraceFindingId))
})

const ThinkingBlock = Schema.Struct({
  type: Schema.Literal("thinking"),
  blockId: OpenAgentTraceBlockId,
  thinking: Schema.String,
  redactionRefs: Schema.optional(Schema.Array(OpenAgentTraceFindingId))
})

const ToolCallBlock = Schema.Struct({
  type: Schema.Literal("toolCall"),
  blockId: OpenAgentTraceBlockId,
  toolCallId: Schema.String,
  toolName: Schema.String,
  arguments: FieldRecord,
  redactionRefs: Schema.optional(Schema.Array(OpenAgentTraceFindingId))
})

const JsonBlock = Schema.Struct({
  type: Schema.Literal("json"),
  blockId: OpenAgentTraceBlockId,
  data: FieldRecord,
  redactionRefs: Schema.optional(Schema.Array(OpenAgentTraceFindingId))
})

/**
 * Canonical actor descriptor for normalized open-agent-trace events.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceActor = Schema.Struct({
  actorKind: Schema.Literal("user", "assistant", "tool", "runtime", "system", "custom"),
  role: Schema.String,
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  toolName: Schema.optional(Schema.String),
  customType: Schema.optional(Schema.String)
})

/**
 * Canonical normalized content-block family.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceContentBlock = Schema.Union(TextBlock, ImageBlock, ThinkingBlock, ToolCallBlock, JsonBlock)

/**
 * Preserved runtime provenance for assistant turns sourced from `pi`.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTracePiTurnProvenance = Schema.Struct({
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  api: Schema.optional(Schema.String),
  stopReason: Schema.optional(Schema.String),
  cacheReadTokens: Schema.optional(Schema.Number),
  cacheWriteTokens: Schema.optional(Schema.Number),
  costUsd: Schema.optional(Schema.Number)
})

/**
 * Canonical source locator for one normalized public trace row.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceSource extends Schema.Class<OpenAgentTraceSource>("OpenAgentTraceSource")({
  datasetId: Schema.String,
  datasetRevision: Schema.String,
  split: Schema.String,
  rowKey: OpenAgentTraceSessionId,
  sourceUrl: Schema.String,
  licenseTag: Schema.String,
  harness: Schema.String,
  sessionId: OpenAgentTraceSessionId,
  fileName: Schema.String,
  sourceHash: OpenAgentTraceContentDigest,
  redactionKey: OpenAgentTraceRedactionKey,
  redactedHash: OpenAgentTraceContentDigest
}) {}

/**
 * Canonical normalized session header.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceSession extends Schema.Class<OpenAgentTraceSession>("OpenAgentTraceSession")({
  sessionId: OpenAgentTraceSessionId,
  sessionVersion: Schema.Number,
  cwd: Schema.String,
  parentSession: Schema.optional(Schema.String),
  startedAt: Schema.String
}) {}

/**
 * Canonical active-path selection record.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceSelection extends Schema.Class<OpenAgentTraceSelection>("OpenAgentTraceSelection")({
  selectedLeafEntryId: OpenAgentTraceEventId,
  selectionPolicy: Schema.Literal("latest-leaf"),
  activePathEntryIds: Schema.Array(OpenAgentTraceEventId),
  compactedPathEntryIds: Schema.Array(OpenAgentTraceEventId),
  abandonedBranchRootIds: Schema.Array(OpenAgentTraceEventId)
}) {}

/**
 * Canonical branch-lineage unit.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceBranch extends Schema.Class<OpenAgentTraceBranch>("OpenAgentTraceBranch")({
  branchId: OpenAgentTraceEventId,
  parentBranchId: Schema.optional(OpenAgentTraceEventId),
  leafEntryId: OpenAgentTraceEventId,
  fromEntryId: Schema.optional(OpenAgentTraceEventId),
  branchSummaryEntryId: Schema.optional(OpenAgentTraceEventId),
  branchSummaryText: Schema.optional(Schema.String)
}) {}
