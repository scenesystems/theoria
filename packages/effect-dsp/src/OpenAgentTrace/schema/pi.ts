/**
 * Raw `pi-share-hf` and `pi-mono` source contracts consumed by the open-agent-trace lane.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { OpenAgentTraceManifestDigest, OpenAgentTraceRedactionKey } from "./normalized/authorities.js"

const TextBlock = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String
})

const ImageBlock = Schema.Struct({
  type: Schema.Literal("image"),
  data: Schema.String,
  mimeType: Schema.String
})

const ThinkingBlock = Schema.Struct({
  type: Schema.Literal("thinking"),
  thinking: Schema.String
})

const ToolCallBlock = Schema.Struct({
  type: Schema.Literal("toolCall"),
  id: Schema.String,
  name: Schema.String,
  arguments: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const AssistantUsage = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  cacheRead: Schema.Number,
  cacheWrite: Schema.Number,
  totalTokens: Schema.Number,
  cost: Schema.Struct({
    input: Schema.Number,
    output: Schema.Number,
    cacheRead: Schema.Number,
    cacheWrite: Schema.Number,
    total: Schema.Number
  })
})

const UserMessage = Schema.Struct({
  role: Schema.Literal("user"),
  content: Schema.Union(Schema.String, Schema.Array(Schema.Union(TextBlock, ImageBlock))),
  timestamp: Schema.Number
})

const AssistantMessage = Schema.Struct({
  role: Schema.Literal("assistant"),
  content: Schema.Array(Schema.Union(TextBlock, ImageBlock, ThinkingBlock, ToolCallBlock)),
  api: Schema.String,
  provider: Schema.String,
  model: Schema.String,
  usage: AssistantUsage,
  stopReason: Schema.Literal("stop", "length", "toolUse", "error", "aborted"),
  errorMessage: Schema.optional(Schema.String),
  timestamp: Schema.Number
})

const ToolResultMessage = Schema.Struct({
  role: Schema.Literal("toolResult"),
  toolCallId: Schema.String,
  toolName: Schema.String,
  content: Schema.Array(Schema.Union(TextBlock, ImageBlock)),
  details: Schema.optional(Schema.Unknown),
  isError: Schema.Boolean,
  timestamp: Schema.Number
})

const BashExecutionMessage = Schema.Struct({
  role: Schema.Literal("bashExecution"),
  command: Schema.String,
  output: Schema.String,
  exitCode: Schema.optional(Schema.NullOr(Schema.Number)),
  cancelled: Schema.Boolean,
  truncated: Schema.Boolean,
  fullOutputPath: Schema.optional(Schema.String),
  excludeFromContext: Schema.optional(Schema.Boolean),
  timestamp: Schema.Number
})

const CustomMessage = Schema.Struct({
  role: Schema.Literal("custom", "hookMessage"),
  customType: Schema.String,
  content: Schema.Union(Schema.String, Schema.Array(Schema.Union(TextBlock, ImageBlock))),
  display: Schema.Boolean,
  details: Schema.optional(Schema.Unknown),
  timestamp: Schema.Number
})

const PiMessage = Schema.Union(
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  BashExecutionMessage,
  CustomMessage
)

const PiEntryBase = Schema.Struct({
  id: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  timestamp: Schema.String
})

/**
 * One uploaded `manifest.jsonl` entry produced by `pi-share-hf`.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PiShareHfManifestEntry extends Schema.Class<PiShareHfManifestEntry>("PiShareHfManifestEntry")({
  file: Schema.String,
  source_hash: OpenAgentTraceManifestDigest,
  redaction_key: OpenAgentTraceRedactionKey,
  redacted_hash: OpenAgentTraceManifestDigest
}) {}

/**
 * One `badlogicgames/pi-mono` Hugging Face dataset row.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PiMonoDatasetRow extends Schema.Class<PiMonoDatasetRow>("PiMonoDatasetRow")({
  harness: Schema.String,
  session_id: Schema.String,
  traces: Schema.Array(Schema.Unknown),
  file_name: Schema.String
}) {}

/**
 * Raw `pi` session header.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PiSessionHeader extends Schema.Class<PiSessionHeader>("PiSessionHeader")({
  type: Schema.Literal("session"),
  version: Schema.optional(Schema.Number),
  id: Schema.String,
  timestamp: Schema.String,
  cwd: Schema.String,
  parentSession: Schema.optional(Schema.String)
}) {}

/**
 * Canonical migrated `pi` session entry family.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PiSessionEntry = Schema.Union(
  PiEntryBase.pipe(Schema.extend(Schema.Struct({ type: Schema.Literal("message"), message: PiMessage }))),
  PiEntryBase.pipe(
    Schema.extend(
      Schema.Struct({ type: Schema.Literal("model_change"), provider: Schema.String, modelId: Schema.String })
    )
  ),
  PiEntryBase.pipe(
    Schema.extend(Schema.Struct({ type: Schema.Literal("thinking_level_change"), thinkingLevel: Schema.String }))
  ),
  PiEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("compaction"),
        summary: Schema.String,
        firstKeptEntryId: Schema.String,
        tokensBefore: Schema.Number,
        details: Schema.optional(Schema.Unknown),
        fromHook: Schema.optional(Schema.Boolean)
      })
    )
  ),
  PiEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("branch_summary"),
        fromId: Schema.String,
        summary: Schema.String,
        details: Schema.optional(Schema.Unknown),
        fromHook: Schema.optional(Schema.Boolean)
      })
    )
  ),
  PiEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("custom"),
        customType: Schema.String,
        data: Schema.optional(Schema.Unknown)
      })
    )
  ),
  PiEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("custom_message"),
        customType: Schema.String,
        content: Schema.Union(Schema.String, Schema.Array(Schema.Union(TextBlock, ImageBlock))),
        display: Schema.Boolean,
        details: Schema.optional(Schema.Unknown)
      })
    )
  ),
  PiEntryBase.pipe(
    Schema.extend(
      Schema.Struct({ type: Schema.Literal("label"), targetId: Schema.String, label: Schema.optional(Schema.String) })
    )
  ),
  PiEntryBase.pipe(
    Schema.extend(Schema.Struct({ type: Schema.Literal("session_info"), name: Schema.optional(Schema.String) }))
  )
)

/**
 * Decoded migrated `pi` session entry.
 *
 * @since 0.2.0
 * @category type-level
 */
export type PiSessionEntry = typeof PiSessionEntry.Type
