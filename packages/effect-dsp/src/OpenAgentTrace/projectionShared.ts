/**
 * Shared helpers for workflow and usage projection over normalized traces.
 *
 * @since 0.2.0
 */
import { Effect, Match, Option, Schema } from "effect"
import type { WorkflowKind } from "effect-inference/Contracts"

import { PiUsageProjection, UsageSample } from "./projectionSchema.js"
import { type OpenAgentTraceEvent, OpenAgentTraceMessage, type OpenAgentTraceRecord } from "./schema.js"

/**
 * The first bounded workflow and example projection version.
 *
 * @since 0.2.0
 */
export const PROJECTION_VERSION = "1"
type OpenAgentTraceMessageEvent = Schema.Schema.Type<typeof OpenAgentTraceMessage>
/**
 * Narrow a normalized trace event to the message-event family used by workflow projection.
 *
 * @since 0.2.0
 */
export const isMessageEvent = (event: OpenAgentTraceEvent): event is OpenAgentTraceMessageEvent =>
  Schema.is(OpenAgentTraceMessage)(event)

const decodeOptionalNumber = (value: unknown) =>
  Option.match(Option.fromNullable(value), {
    onNone: () => Effect.succeed(Option.none<number>()),
    onSome: (presentValue) => Effect.map(Schema.decodeUnknown(Schema.Number)(presentValue), Option.some)
  })

/**
 * Collapse one normalized content block into the bounded text form used by workflow and example projections.
 *
 * @since 0.2.0
 */
export const blockText = (block: OpenAgentTraceMessageEvent["contentBlocks"][number]): string =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }) => text),
    Match.when({ type: "thinking" }, ({ thinking }) => thinking),
    Match.when({ type: "image" }, ({ mimeType }) => `[image:${mimeType}]`),
    Match.when({ type: "toolCall" }, ({ toolName, toolCallId }) => `${toolName}:${toolCallId}`),
    Match.when({ type: "json" }, () => "[json]"),
    Match.exhaustive
  )

/**
 * Concatenate the projected text surface for one normalized message event.
 *
 * @since 0.2.0
 */
export const messageText = (event: OpenAgentTraceMessageEvent): string => event.contentBlocks.map(blockText).join("\n")
/**
 * Derive the reusable workflow kind from the normalized session authority.
 *
 * @since 0.2.0
 */
export const workflowKindFrom = (record: OpenAgentTraceRecord): WorkflowKind =>
  Option.match(Option.fromNullable(record.session.parentSession), {
    onNone: () => "task-first",
    onSome: () => "chat-continuation"
  })
/**
 * Map a workflow kind onto the bounded evaluation profile family used by the first projection lane.
 *
 * @since 0.2.0
 */
export const profileFamilyFrom = (workflowKind: WorkflowKind) =>
  workflowKind === "chat-continuation" ? "chat-oriented" : "task-oriented"

/**
 * Preserve bounded assistant-usage provenance while folding cache hits into the public usage sample.
 *
 * @since 0.2.0
 */
export const assistantUsageProjection = (event: OpenAgentTraceMessageEvent) =>
  Effect.gen(function*() {
    const inputTokens = yield* decodeOptionalNumber(event.usage?.input)
    const outputTokens = yield* decodeOptionalNumber(event.usage?.output)
    const cacheReadTokens = yield* decodeOptionalNumber(event.usage?.cacheRead)
    const cacheWriteTokens = yield* decodeOptionalNumber(event.usage?.cacheWrite)
    const totalTokens = yield* decodeOptionalNumber(event.usage?.totalTokens)
    const costUsd = yield* decodeOptionalNumber(event.usage?.costUsd)

    return PiUsageProjection.make({
      eventId: event.eventId,
      provider: event.piTurnProvenance?.provider,
      model: event.piTurnProvenance?.model,
      api: event.piTurnProvenance?.api,
      stopReason: event.piTurnProvenance?.stopReason,
      usage: UsageSample.make({
        cached: Option.getOrElse(cacheReadTokens, () => 0) > 0,
        ...Option.match(inputTokens, {
          onNone: () => ({}),
          onSome: (value) => ({ inputTokens: value })
        }),
        ...Option.match(outputTokens, {
          onNone: () => ({}),
          onSome: (value) => ({ outputTokens: value })
        })
      }),
      ...Option.match(cacheReadTokens, {
        onNone: () => ({}),
        onSome: (value) => ({ cacheReadTokens: value })
      }),
      ...Option.match(cacheWriteTokens, {
        onNone: () => ({}),
        onSome: (value) => ({ cacheWriteTokens: value })
      }),
      ...Option.match(totalTokens, {
        onNone: () => ({}),
        onSome: (value) => ({ totalTokens: value })
      }),
      ...Option.match(costUsd, {
        onNone: () => ({}),
        onSome: (value) => ({ costUsd: value })
      })
    })
  })
