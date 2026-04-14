/**
 * Entry-to-event normalization helpers for the `pi-mono` adapter.
 *
 * @since 0.2.0
 */
import { Effect, Option } from "effect"

import {
  type OpenAgentTraceEvent,
  OpenAgentTraceMessage,
  OpenAgentTraceMetadataEvent,
  OpenAgentTraceRuntimeEvent,
  OpenAgentTraceSummaryEvent,
  type PiSessionEntry
} from "../schema.js"
import { normalizeContent } from "./blocks.js"

/**
 * Converts one canonical migrated `pi` entry into a normalized open-agent-trace event.
 *
 * @since 0.2.0
 * @category combinators
 */
export const normalizePiSessionEntry = (entry: PiSessionEntry): Effect.Effect<OpenAgentTraceEvent, unknown> => {
  if (entry.type === "message") {
    if (entry.message.role === "bashExecution") {
      return Effect.succeed(
        OpenAgentTraceRuntimeEvent.make({
          eventId: entry.id,
          parentEventId: entry.parentId ?? undefined,
          timestamp: entry.timestamp,
          eventKind: "bash-execution",
          actor: { actorKind: "runtime", role: entry.message.role, toolName: "bash" },
          command: entry.message.command,
          outputText: entry.message.output,
          exitCode: entry.message.exitCode ?? undefined,
          cancelled: entry.message.cancelled,
          truncated: entry.message.truncated
        })
      )
    }

    if (entry.message.role === "custom" || entry.message.role === "hookMessage") {
      const customMessage = entry.message

      return Effect.map(
        normalizeContent(entry.id, customMessage.content),
        (contentBlocks) =>
          OpenAgentTraceMetadataEvent.make({
            eventId: entry.id,
            parentEventId: entry.parentId ?? undefined,
            timestamp: entry.timestamp,
            eventKind: "custom-message",
            actor: { actorKind: "custom", role: customMessage.role, customType: customMessage.customType },
            contentBlocks
          })
      )
    }

    return Effect.map(normalizeContent(entry.id, entry.message.content), (contentBlocks) =>
      OpenAgentTraceMessage.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "message",
        actor: entry.message.role === "assistant"
          ? {
            actorKind: "assistant",
            role: entry.message.role,
            provider: entry.message.provider,
            model: entry.message.model
          }
          : entry.message.role === "toolResult"
          ? { actorKind: "tool", role: entry.message.role, toolName: entry.message.toolName }
          : { actorKind: "user", role: entry.message.role },
        contentBlocks,
        usage: entry.message.role === "assistant"
          ? {
            input: entry.message.usage.input,
            output: entry.message.usage.output,
            cacheRead: entry.message.usage.cacheRead,
            cacheWrite: entry.message.usage.cacheWrite,
            totalTokens: entry.message.usage.totalTokens,
            costUsd: entry.message.usage.cost.total
          }
          : undefined,
        piTurnProvenance: entry.message.role === "assistant"
          ? {
            provider: entry.message.provider,
            model: entry.message.model,
            api: entry.message.api,
            stopReason: entry.message.stopReason,
            cacheReadTokens: entry.message.usage.cacheRead,
            cacheWriteTokens: entry.message.usage.cacheWrite,
            costUsd: entry.message.usage.cost.total
          }
          : undefined,
        errorMessage: entry.message.role === "assistant" ? entry.message.errorMessage : undefined
      }))
  }

  if (entry.type === "model_change") {
    return Effect.succeed(
      OpenAgentTraceRuntimeEvent.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "model-change",
        actor: { actorKind: "runtime", role: entry.type, provider: entry.provider, model: entry.modelId },
        modelId: entry.modelId
      })
    )
  }

  if (entry.type === "thinking_level_change") {
    return Effect.succeed(
      OpenAgentTraceRuntimeEvent.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "thinking-level-change",
        actor: { actorKind: "runtime", role: entry.type },
        thinkingLevel: entry.thinkingLevel
      })
    )
  }

  if (entry.type === "compaction") {
    return Effect.succeed(
      OpenAgentTraceSummaryEvent.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "compaction",
        summaryText: entry.summary,
        firstKeptEntryId: entry.firstKeptEntryId,
        tokensBefore: entry.tokensBefore
      })
    )
  }

  if (entry.type === "branch_summary") {
    return Effect.succeed(
      OpenAgentTraceSummaryEvent.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "branch-summary",
        summaryText: entry.summary,
        fromEntryId: entry.fromId
      })
    )
  }

  if (entry.type === "custom") {
    return Effect.succeed(
      OpenAgentTraceMetadataEvent.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "custom",
        actor: { actorKind: "custom", role: entry.type, customType: entry.customType },
        data: Option.match(Option.fromNullable(entry.data), {
          onNone: () => undefined,
          onSome: () => ({ customType: entry.customType, persisted: true })
        })
      })
    )
  }

  if (entry.type === "custom_message") {
    return Effect.map(normalizeContent(entry.id, entry.content), (contentBlocks) =>
      OpenAgentTraceMetadataEvent.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "custom-message",
        actor: { actorKind: "custom", role: entry.type, customType: entry.customType },
        contentBlocks
      }))
  }

  if (entry.type === "label") {
    return Effect.succeed(
      OpenAgentTraceMetadataEvent.make({
        eventId: entry.id,
        parentEventId: entry.parentId ?? undefined,
        timestamp: entry.timestamp,
        eventKind: "label",
        label: entry.label,
        targetId: entry.targetId
      })
    )
  }

  return Effect.succeed(
    OpenAgentTraceMetadataEvent.make({
      eventId: entry.id,
      parentEventId: entry.parentId ?? undefined,
      timestamp: entry.timestamp,
      eventKind: "session-info",
      sessionName: entry.name
    })
  )
}
