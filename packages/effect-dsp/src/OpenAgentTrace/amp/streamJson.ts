/**
 * Amp stream-json capture decoding and normalization.
 *
 * @since 0.2.0
 */
import { Effect, Option, Schema } from "effect"
import type { ParseResult } from "effect"

import { FieldRecord } from "../../contracts/FieldValue.js"
import { makeAdapter, type NormalizeCaptureOptions, type NormalizeCaptureResult } from "../adapter.js"
import type { OpenAgentTraceAdapterCapture } from "../adapterSchema.js"
import { type OpenAgentTraceEvent, OpenAgentTraceEvent as OpenAgentTraceEventSchema } from "../schema.js"
import {
  ampMessageEvent,
  ampShellRuntimeEvent,
  normalizeAssistantBlocks,
  normalizeUserBlocks,
  shellCommandFromToolUse
} from "./content.js"
import { ampCoverage } from "./coverage.js"
import { normalizeAmpRecord, type NormalizeAmpRecordOptions } from "./normalize.js"

const StreamParentToolUseId = Schema.Union(Schema.String, Schema.Null)
const StreamUsage = Schema.Struct({
  input_tokens: Schema.Number,
  output_tokens: Schema.Number,
  max_tokens: Schema.Number,
  cache_creation_input_tokens: Schema.optional(Schema.Number),
  cache_read_input_tokens: Schema.optional(Schema.Number),
  service_tier: Schema.optional(Schema.String)
})
const StreamTextBlock = Schema.Struct({ type: Schema.Literal("text"), text: Schema.String })
const StreamThinkingBlock = Schema.Struct({ type: Schema.Literal("thinking"), thinking: Schema.String })
const StreamRedactedThinkingBlock = Schema.Struct({ type: Schema.Literal("redacted_thinking"), data: Schema.String })
const StreamToolUseBlock = Schema.Struct({
  type: Schema.Literal("tool_use"),
  id: Schema.String,
  name: Schema.String,
  input: FieldRecord
})
const StreamToolResultBlock = Schema.Struct({
  type: Schema.Literal("tool_result"),
  tool_use_id: Schema.String,
  content: Schema.String,
  is_error: Schema.Boolean
})
const StreamJsonLine = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("system"),
    subtype: Schema.Literal("init"),
    cwd: Schema.String,
    session_id: Schema.String,
    tools: Schema.Array(Schema.String),
    mcp_servers: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.String }))
  }),
  Schema.Struct({
    type: Schema.Literal("user"),
    message: Schema.Struct({
      role: Schema.Literal("user"),
      content: Schema.Array(Schema.Union(StreamTextBlock, StreamToolResultBlock))
    }),
    parent_tool_use_id: StreamParentToolUseId,
    session_id: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal("assistant"),
    message: Schema.Struct({
      type: Schema.Literal("message"),
      role: Schema.Literal("assistant"),
      content: Schema.Array(
        Schema.Union(StreamTextBlock, StreamThinkingBlock, StreamRedactedThinkingBlock, StreamToolUseBlock)
      ),
      stop_reason: Schema.Union(Schema.Literal("end_turn", "tool_use", "max_tokens"), Schema.Null),
      usage: Schema.optional(StreamUsage)
    }),
    parent_tool_use_id: StreamParentToolUseId,
    session_id: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal("result"),
    subtype: Schema.String,
    duration_ms: Schema.Number,
    is_error: Schema.Boolean,
    num_turns: Schema.Number,
    result: Schema.String,
    session_id: Schema.String,
    usage: Schema.optional(StreamUsage)
  })
)

/**
 * Raw Amp `--stream-json` capture document normalized by the package-owned adapter.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpStreamJsonCapture = Schema.Struct({
  startedAt: Schema.String,
  lines: Schema.NonEmptyArray(StreamJsonLine)
})

/**
 * Raw Amp `--stream-json` capture document normalized by the package-owned adapter.
 *
 * @since 0.2.0
 * @category schemas
 */
export type AmpStreamJsonCapture = typeof AmpStreamJsonCapture.Type

/**
 * Decode a raw Amp `--stream-json` capture document.
 *
 * @since 0.2.0
 * @category constructors
 */
export const decodeStreamJson = Schema.decodeUnknown(AmpStreamJsonCapture)
const decodeOpenAgentTraceEvent = Schema.decodeUnknown(OpenAgentTraceEventSchema)

type NormalizedAmpEvents = ReadonlyArray<OpenAgentTraceEvent>
type DecodedStreamJsonLine = typeof StreamJsonLine.Type

const usageRecord = (line: Extract<DecodedStreamJsonLine, { readonly type: "assistant" }>) =>
  Option.match(Option.fromNullable(line.message.usage), {
    onNone: () => Option.none<FieldRecord>(),
    onSome: (usage) =>
      Option.some({
        input: usage.input_tokens,
        output: usage.output_tokens,
        maxTokens: usage.max_tokens,
        ...Option.match(Option.fromNullable(usage.cache_read_input_tokens), {
          onNone: () => ({}),
          onSome: (cacheRead) => ({ cacheRead })
        }),
        ...Option.match(Option.fromNullable(usage.cache_creation_input_tokens), {
          onNone: () => ({}),
          onSome: (cacheWrite) => ({ cacheWrite })
        }),
        ...Option.match(Option.fromNullable(usage.service_tier), {
          onNone: () => ({}),
          onSome: (serviceTier) => ({ serviceTier })
        })
      })
  })

const priorToolUseBlock = (lines: ReadonlyArray<DecodedStreamJsonLine>, index: number, toolUseId: string) =>
  Option.fromNullable(
    lines.slice(0, index).flatMap((line) =>
      line.type === "assistant"
        ? line.message.content.flatMap((block) =>
          block.type === "tool_use" && block.id === toolUseId ? [{ toolName: block.name, input: block.input }] : []
        )
        : []
    ).at(-1)
  )

const normalizeStreamUserLine = (lines: ReadonlyArray<DecodedStreamJsonLine>, index: number) =>
(
  line: Extract<typeof StreamJsonLine.Type, { readonly type: "user" }>
): Effect.Effect<NormalizedAmpEvents, ParseResult.ParseError> => {
  const shellEvents = line.message.content.flatMap((block) => {
    if (block.type !== "tool_result") {
      return []
    }

    const toolUse = priorToolUseBlock(lines, index, block.tool_use_id)

    return Option.match(toolUse, {
      onNone: () => [],
      onSome: (resolvedToolUse) =>
        Option.match(shellCommandFromToolUse(resolvedToolUse.toolName, resolvedToolUse.input), {
          onNone: () => [],
          onSome: (shellCommand) => [ampShellRuntimeEvent({
            eventId: `amp-stream-json:tool:${block.tool_use_id}`,
            timestamp: `${line.session_id}:user:${index}`,
            toolName: resolvedToolUse.toolName,
            command: shellCommand.command,
            outputText: Option.some(block.content),
            status: block.is_error ? "error" : "done",
            isError: Option.some(block.is_error),
            exitCode: Option.none()
          })]
        })
    })
  })

  return shellEvents.length > 0 && line.message.content.every((block) => block.type === "tool_result")
    ? Effect.succeed(shellEvents)
    : Effect.map(
      normalizeUserBlocks(
        `amp-stream-json:user:${index}`,
        line.message.content.map((block) =>
          block.type === "text"
            ? block
            : {
              type: "tool_result",
              toolUseID: block.tool_use_id,
              content: block.content,
              is_error: block.is_error,
              status: block.is_error ? "error" : "done"
            }
        )
      ),
      (contentBlocks) => [ampMessageEvent({
        eventId: `amp-stream-json:user:${index}`,
        timestamp: `${line.session_id}:user:${index}`,
        actorKind: "user",
        role: "user",
        contentBlocks,
        usage: Option.none()
      })]
    )
}

/**
 * Normalize an Amp `--stream-json` capture through the shared adapter seam.
 *
 * @since 0.2.0
 * @category constructors
 */
export const normalizeStreamJson = (
  capture: OpenAgentTraceAdapterCapture,
  options?: NormalizeCaptureOptions
): Effect.Effect<NormalizeCaptureResult, ParseResult.ParseError> =>
  Effect.gen(function*() {
    const payload = yield* decodeStreamJson(capture.payload)
    const init = payload.lines.find((line) => line.type === "system")
    const normalizedEvents = yield* Effect.forEach(payload.lines, (line, index) => {
      if (line.type === "assistant") {
        return Effect.map(
          normalizeAssistantBlocks(`amp-stream-json:assistant:${index}`, line.message.content),
          (contentBlocks): NormalizedAmpEvents => [ampMessageEvent({
            eventId: `amp-stream-json:assistant:${index}`,
            timestamp: `${line.session_id}:assistant:${index}`,
            actorKind: "assistant",
            role: "assistant",
            contentBlocks,
            usage: usageRecord(line)
          })]
        )
      }

      return line.type === "user"
        ? normalizeStreamUserLine(payload.lines, index)(line)
        : Effect.succeed([])
    }, { concurrency: 1 })
    const initCwd = Option.match(Option.fromNullable(init), {
      onNone: () => "",
      onSome: (systemLine) => systemLine.cwd
    })
    const coverage = ampCoverage({
      sessionId: capture.source.sessionId,
      missingUsage: payload.lines.some((line) =>
        line.type === "assistant" && Option.isNone(Option.fromNullable(line.message.usage))
      ),
      missingBranchLineage: true
    })
    const flatEvents = normalizedEvents.flatMap((value) => value)
    const linkedEvents = yield* Effect.forEach(
      flatEvents,
      (event, index) =>
        decodeOpenAgentTraceEvent({
          ...event,
          ...Option.match(Option.fromNullable(flatEvents[index - 1]?.eventId), {
            onNone: () => ({}),
            onSome: (parentEventId) => ({ parentEventId })
          })
        }),
      { concurrency: 1 }
    )
    const recordEvents: readonly [OpenAgentTraceEvent, ...ReadonlyArray<OpenAgentTraceEvent>] = [
      linkedEvents[0]!,
      ...linkedEvents.slice(1)
    ]
    const baseRecordOptions: NormalizeAmpRecordOptions = {
      adapterKind: "amp-stream-json",
      captureId: capture.captureId,
      sourceId: capture.source.sourceId,
      sourceRevision: capture.source.sourceRevision,
      sourceUrl: capture.source.sourceUrl,
      licenseTag: capture.source.licenseTag,
      harness: capture.source.harness,
      sessionId: capture.source.sessionId,
      ...Option.match(Option.fromNullable(capture.source.fileName), {
        onNone: () => ({}),
        onSome: (fileName) => ({ fileName })
      }),
      ...Option.match(Option.fromNullable(capture.source.sourceHash), {
        onNone: () => ({}),
        onSome: (sourceHash) => ({ sourceHash })
      }),
      cwd: initCwd,
      startedAt: payload.startedAt,
      payload,
      events: recordEvents,
      coverageGaps: coverage.recordGaps
    }

    const recordOptions = Option.match(Option.fromNullable(options), {
      onNone: () => baseRecordOptions,
      onSome: (presentOptions) => ({
        ...baseRecordOptions,
        options: presentOptions
      })
    })

    return {
      record: yield* normalizeAmpRecord(recordOptions),
      coverageGaps: coverage.adapterGaps
    }
  })

/**
 * Shared adapter for Amp `--stream-json` captures.
 *
 * @since 0.2.0
 * @category constructors
 */
export const streamJsonAdapter = makeAdapter({
  kind: "amp-stream-json",
  normalize: normalizeStreamJson
})
