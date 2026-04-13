/**
 * Raw-Amp-to-normalized content and runtime-event helpers.
 *
 * @since 0.2.0
 */
import { Array as Arr, Effect, Option, Predicate, Record as Rec, Schema } from "effect"

import type { FieldRecord } from "../../contracts/FieldValue.js"
import { type FieldValue } from "../../contracts/FieldValue.js"
import {
  OpenAgentTraceBlockId,
  OpenAgentTraceContentBlock,
  OpenAgentTraceMessage,
  OpenAgentTraceMetadataEvent,
  OpenAgentTraceRuntimeEvent
} from "../schema.js"

type AmpActorKind = "assistant" | "system" | "tool" | "user"
type AmpBlock = typeof OpenAgentTraceContentBlock.Type

const decodeBlock = Schema.decodeUnknown(OpenAgentTraceContentBlock)
const decodeBlockId = Schema.decode(OpenAgentTraceBlockId)

const textBlock = (eventId: string, index: number, text: string) =>
  Effect.flatMap(decodeBlockId(`${eventId}:text:${index}`), (blockId) => decodeBlock({ type: "text", blockId, text }))

const thinkingBlock = (eventId: string, index: number, thinking: string) =>
  Effect.flatMap(
    decodeBlockId(`${eventId}:thinking:${index}`),
    (blockId) => decodeBlock({ type: "thinking", blockId, thinking })
  )

const toolCallBlock = (eventId: string, index: number, toolCallId: string, toolName: string, input: FieldRecord) =>
  Effect.flatMap(
    decodeBlockId(`${eventId}:toolCall:${toolCallId}:${index}`),
    (blockId) => decodeBlock({ type: "toolCall", blockId, toolCallId, toolName, arguments: input })
  )

const jsonBlock = (eventId: string, index: number, data: FieldRecord) =>
  Effect.flatMap(decodeBlockId(`${eventId}:json:${index}`), (blockId) => decodeBlock({ type: "json", blockId, data }))

const emptyRecord: FieldRecord = {}

const fieldValueFrom = (value: unknown): Option.Option<FieldValue> =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null
    ? Option.some(value)
    : Arr.isArray(value)
    ? Option.some(Arr.filterMap(value, fieldValueFrom))
    : Predicate.isRecord(value)
    ? Option.some(Rec.fromEntries(
      Arr.flatMap(Rec.toEntries(value), ([key, nestedValue]) => {
        return Option.match(fieldValueFrom(nestedValue), {
          onNone: () => Arr.empty<[string, FieldValue]>(),
          onSome: (fieldValue) => Arr.of<[string, FieldValue]>([key, fieldValue])
        })
      })
    ))
    : Option.none()

const jsonRecordFrom = (value: unknown): FieldRecord =>
  Predicate.isRecord(value)
    ? Rec.fromEntries(
      Arr.flatMap(Rec.toEntries(value), ([key, nestedValue]) => {
        return Option.match(fieldValueFrom(nestedValue), {
          onNone: () => Arr.empty<[string, FieldValue]>(),
          onSome: (fieldValue) => Arr.of<[string, FieldValue]>([key, fieldValue])
        })
      })
    )
    : emptyRecord

const statusExitCode = (status: "cancelled" | "done" | "error", isError: boolean): Option.Option<number> =>
  status === "done" && !isError ? Option.some(0) : status === "cancelled" ? Option.none() : Option.some(1)

/**
 * Derive normalized blocks from assistant-originated Amp content.
 *
 * @since 0.2.0
 * @category combinators
 */
export const normalizeAssistantBlocks = (eventId: string, blocks: ReadonlyArray<Record<string, unknown>>) =>
  Effect.map(
    Effect.forEach(
      blocks,
      (block, index) =>
        block.type === "text"
          ? textBlock(eventId, index, typeof block.text === "string" ? block.text : "")
          : block.type === "thinking"
          ? thinkingBlock(eventId, index, typeof block.thinking === "string" ? block.thinking : "")
          : block.type === "tool_use"
          ? toolCallBlock(
            eventId,
            index,
            typeof block.id === "string" ? block.id : `${eventId}:tool:${index}`,
            typeof block.name === "string" ? block.name : "tool",
            jsonRecordFrom(block.input)
          )
          : jsonBlock(eventId, index, { redactedThinking: typeof block.data === "string" ? block.data : "" }),
      { concurrency: 1 }
    ),
    Arr.fromIterable
  )

/**
 * Derive normalized blocks from user or tool-result Amp content.
 *
 * @since 0.2.0
 * @category combinators
 */
export const normalizeUserBlocks = (eventId: string, blocks: ReadonlyArray<Record<string, unknown>>) =>
  Effect.map(
    Effect.forEach(
      blocks,
      (block, index) =>
        block.type === "text"
          ? textBlock(eventId, index, typeof block.text === "string" ? block.text : "")
          : jsonBlock(eventId, index, {
            toolUseId: typeof block.toolUseID === "string" ? block.toolUseID : "",
            status: typeof block.status === "string" ? block.status : "pending",
            output: typeof block.output === "string"
              ? block.output
              : typeof block.content === "string"
              ? block.content
              : "",
            isError: typeof block.is_error === "boolean" ? block.is_error : false
          }),
      { concurrency: 1 }
    ),
    Arr.fromIterable
  )

/**
 * Create a normalized Amp message event.
 *
 * @since 0.2.0
 * @category combinators
 */
export const ampMessageEvent = (options: {
  readonly eventId: string
  readonly timestamp: string
  readonly actorKind: AmpActorKind
  readonly role: string
  readonly contentBlocks: ReadonlyArray<AmpBlock>
  readonly usage: Option.Option<FieldRecord>
}) =>
  OpenAgentTraceMessage.make({
    eventId: options.eventId,
    timestamp: options.timestamp,
    eventKind: "message",
    actor: { actorKind: options.actorKind, role: options.role },
    contentBlocks: Arr.fromIterable(options.contentBlocks),
    ...Option.match(options.usage, {
      onNone: () => emptyRecord,
      onSome: (usage) => ({ usage })
    })
  })

/**
 * Create a normalized Amp info message event.
 *
 * @since 0.2.0
 * @category combinators
 */
export const ampInfoEvent = (options: {
  readonly eventId: string
  readonly timestamp: string
  readonly contentBlocks: ReadonlyArray<AmpBlock>
}) =>
  OpenAgentTraceMetadataEvent.make({
    eventId: options.eventId,
    timestamp: options.timestamp,
    eventKind: "custom-message",
    actor: { actorKind: "system", role: "info" },
    contentBlocks: Arr.fromIterable(options.contentBlocks)
  })

/**
 * Create a normalized shell-execution runtime event.
 *
 * @since 0.2.0
 * @category combinators
 */
export const ampShellRuntimeEvent = (options: {
  readonly eventId: string
  readonly timestamp: string
  readonly toolName: string
  readonly command: string
  readonly outputText: Option.Option<string>
  readonly status: "cancelled" | "done" | "error"
  readonly isError: Option.Option<boolean>
  readonly exitCode: Option.Option<number>
}) =>
  OpenAgentTraceRuntimeEvent.make({
    eventId: options.eventId,
    timestamp: options.timestamp,
    eventKind: "bash-execution",
    actor: { actorKind: "runtime", role: "shell", toolName: options.toolName },
    command: options.command,
    ...Option.match(options.outputText, {
      onNone: () => emptyRecord,
      onSome: (outputText) => ({ outputText })
    }),
    ...Option.match(
      Option.orElse(options.exitCode, () =>
        statusExitCode(options.status, Option.getOrElse(options.isError, () => false))),
      {
        onNone: () =>
          emptyRecord,
        onSome: (exitCode) => ({ exitCode })
      }
    ),
    ...(options.status === "cancelled" ? { cancelled: true } : emptyRecord)
  })

/**
 * Extract a shell command from a tool-use payload when the tool is shell-like.
 *
 * @since 0.2.0
 * @category combinators
 */
export const shellCommandFromToolUse = (toolName: string, input: FieldRecord) => {
  const command = typeof input.cmd === "string"
    ? Option.some(input.cmd)
    : typeof input.command === "string"
    ? Option.some(input.command)
    : Option.none<string>()

  return Arr.some(["Bash", "bash", "shell_command"], (candidate) => candidate === toolName)
    ? Option.map(command, (resolvedCommand) => ({ command: resolvedCommand }))
    : Option.none<{ readonly command: string }>()
}
