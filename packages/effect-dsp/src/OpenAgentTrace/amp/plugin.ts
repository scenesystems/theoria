/**
 * Amp Plugin API capture decoding and normalization.
 *
 * @since 0.2.0
 */
import { Effect, Option, Predicate, Schema } from "effect"
import type { ParseResult } from "effect"

import { makeAdapter, type NormalizeCaptureOptions, type NormalizeCaptureResult } from "../adapter.js"
import type { OpenAgentTraceAdapterCapture } from "../adapterSchema.js"
import { type OpenAgentTraceEvent, OpenAgentTraceEvent as OpenAgentTraceEventSchema } from "../schema.js"
import {
  ampInfoEvent,
  ampMessageEvent,
  ampShellRuntimeEvent,
  normalizeAssistantBlocks,
  normalizeUserBlocks,
  shellCommandFromToolUse
} from "./content.js"
import { ampCoverage } from "./coverage.js"
import { normalizeAmpRecord, type NormalizeAmpRecordOptions } from "./normalize.js"
import { AmpPluginCapture, type AmpPluginThreadMessage, type AmpPluginToolEvent } from "./schema.js"

/**
 * Decode a raw Amp Plugin API capture document.
 *
 * @since 0.2.0
 * @category constructors
 */
export const decodePlugin = Schema.decodeUnknown(AmpPluginCapture)
const decodeOpenAgentTraceEvent = Schema.decodeUnknown(OpenAgentTraceEventSchema)

type NormalizedAmpEvents = ReadonlyArray<OpenAgentTraceEvent>
type AmpPluginToolCallEvent = Extract<AmpPluginToolEvent, { readonly type: "tool.call" }>
type AmpPluginToolResultEvent = Extract<AmpPluginToolEvent, { readonly type: "tool.result" }>

const toolCallEventFor = (events: ReadonlyArray<AmpPluginToolEvent>, toolUseID: string) =>
  Option.fromNullable(
    events.find((event) => event.type === "tool.call" && event.payload.toolUseID === toolUseID)
  ).pipe(
    Option.filter((event): event is AmpPluginToolCallEvent => event.type === "tool.call")
  )

const toolResultEventFor = (events: ReadonlyArray<AmpPluginToolEvent>, toolUseID: string) =>
  Option.fromNullable(
    events.find((event) => event.type === "tool.result" && event.payload.toolUseID === toolUseID)
  ).pipe(
    Option.filter((event): event is AmpPluginToolResultEvent => event.type === "tool.result")
  )

const toolResultText = (event: Option.Option<AmpPluginToolResultEvent>) =>
  Option.flatMap(event, (value) => {
    if (typeof value.payload.output === "string") {
      return Option.some(value.payload.output)
    }

    return Predicate.isRecord(value.payload.output) && typeof value.payload.output.output === "string"
      ? Option.some(value.payload.output.output)
      : Option.fromNullable(value.payload.error)
  })

const toolResultExitCode = (event: Option.Option<AmpPluginToolResultEvent>) =>
  Option.flatMap(
    event,
    (value) =>
      Predicate.isRecord(value.payload.output) && typeof value.payload.output.exitCode === "number"
        ? Option.some(value.payload.output.exitCode)
        : Option.none<number>()
  )

const normalizePluginUserMessage = (options: {
  readonly turnEvents: ReadonlyArray<AmpPluginToolEvent>
  readonly message: Extract<AmpPluginThreadMessage, { readonly role: "user" }>
  readonly timestamp: string
}): Effect.Effect<NormalizedAmpEvents, ParseResult.ParseError> => {
  const onlyToolResults = options.message.content.every((block) => block.type === "tool_result")
  const shellBlocks = options.message.content.flatMap((block) => {
    if (block.type !== "tool_result") {
      return []
    }

    const toolCall = toolCallEventFor(options.turnEvents, block.toolUseID)
    const toolResult = toolResultEventFor(options.turnEvents, block.toolUseID)

    return Option.match(toolCall, {
      onNone: () => [],
      onSome: (toolCallEvent) =>
        Option.match(toolResult, {
          onNone: () => [],
          onSome: (toolResultEvent) =>
            Option.match(shellCommandFromToolUse(toolCallEvent.payload.tool, toolCallEvent.payload.input), {
              onNone: () => [],
              onSome: (shellCommand) => [ampShellRuntimeEvent({
                eventId: `amp-plugin:tool:${block.toolUseID}`,
                timestamp: toolResultEvent.timestamp,
                toolName: toolCallEvent.payload.tool,
                command: shellCommand.command,
                outputText: toolResultText(toolResult),
                status: toolResultEvent.payload.status,
                isError: Option.none(),
                exitCode: toolResultExitCode(toolResult)
              })]
            })
        })
    })
  })

  return shellBlocks.length > 0 && onlyToolResults
    ? Effect.succeed(shellBlocks)
    : Effect.map(
      normalizeUserBlocks(`amp-plugin:user:${options.message.id}`, options.message.content),
      (contentBlocks) => [ampMessageEvent({
        eventId: `amp-plugin:user:${options.message.id}`,
        timestamp: options.timestamp,
        actorKind: "user",
        role: "user",
        contentBlocks,
        usage: Option.none()
      })]
    )
}

const normalizePluginThreadMessage = (turnEvents: ReadonlyArray<AmpPluginToolEvent>, timestamp: string) =>
(
  message: AmpPluginThreadMessage
): Effect.Effect<NormalizedAmpEvents, ParseResult.ParseError> => {
  if (message.role === "assistant") {
    return Effect.map(
      normalizeAssistantBlocks(`amp-plugin:assistant:${message.id}`, message.content),
      (contentBlocks): NormalizedAmpEvents => [ampMessageEvent({
        eventId: `amp-plugin:assistant:${message.id}`,
        timestamp,
        actorKind: "assistant",
        role: "assistant",
        contentBlocks,
        usage: Option.none()
      })]
    )
  }

  if (message.role === "info") {
    return Effect.map(
      normalizeUserBlocks(`amp-plugin:info:${message.id}`, message.content),
      (contentBlocks): NormalizedAmpEvents => [ampInfoEvent({
        eventId: `amp-plugin:info:${message.id}`,
        timestamp,
        contentBlocks
      })]
    )
  }

  return normalizePluginUserMessage({ turnEvents, message, timestamp })
}

/**
 * Normalize an Amp Plugin API capture through the shared adapter seam.
 *
 * @since 0.2.0
 * @category constructors
 */
export const normalizePlugin = (
  capture: OpenAgentTraceAdapterCapture,
  options?: NormalizeCaptureOptions
): Effect.Effect<NormalizeCaptureResult, ParseResult.ParseError> =>
  Effect.gen(function*() {
    const payload = yield* decodePlugin(capture.payload)
    const normalizedEvents = yield* Effect.forEach(
      payload.turns,
      (turn) =>
        Effect.gen(function*() {
          const startedBlocks = yield* normalizeUserBlocks(`amp-plugin:start:${turn.agentStart.payload.id}`, [{
            type: "text",
            text: turn.agentStart.payload.message
          }])
          const turnMessages = yield* Effect.forEach(
            turn.agentEnd.payload.messages.filter((message) =>
              !(message.role === "user" && message.id === turn.agentStart.payload.id)
            ),
            normalizePluginThreadMessage(turn.events, turn.agentEnd.timestamp),
            { concurrency: 1 }
          )

          const turnEvents: NormalizedAmpEvents = [
            ampMessageEvent({
              eventId: `amp-plugin:start:${turn.agentStart.payload.id}`,
              timestamp: turn.agentStart.timestamp,
              actorKind: "user",
              role: "user",
              contentBlocks: startedBlocks,
              usage: Option.none()
            }),
            ...turnMessages.flatMap((value) => value)
          ]

          return turnEvents
        }),
      { concurrency: 1 }
    )
    const coverage = ampCoverage({
      sessionId: capture.source.sessionId,
      missingUsage: true,
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
    const firstEvent = linkedEvents[0]
    const recordEvents: readonly [OpenAgentTraceEvent, ...ReadonlyArray<OpenAgentTraceEvent>] = [
      firstEvent!,
      ...linkedEvents.slice(1)
    ]
    const baseRecordOptions: NormalizeAmpRecordOptions = {
      adapterKind: "amp-plugin",
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
      cwd: payload.cwd,
      startedAt: payload.sessionStart.timestamp,
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
 * Shared adapter for Amp Plugin API captures.
 *
 * @since 0.2.0
 * @category constructors
 */
export const pluginAdapter = makeAdapter({
  kind: "amp-plugin",
  normalize: normalizePlugin
})
