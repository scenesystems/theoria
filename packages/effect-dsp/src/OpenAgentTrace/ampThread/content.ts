/**
 * Amp thread export content mapping into canonical OpenAgentTrace events.
 *
 * @since 0.2.0
 */
import { Array as Arr, DateTime, Effect, Option, Predicate } from "effect"
import type * as ParseResult from "effect/ParseResult"

import {
  ampMessageEvent,
  ampShellRuntimeEvent,
  normalizeAssistantBlocks,
  normalizeUserBlocks,
  shellCommandFromToolUse
} from "../amp/content.js"
import type { OpenAgentTraceEvent } from "../schema.js"

import type {
  AmpThreadContent,
  AmpThreadMessage,
  AmpThreadToolResultContent,
  AmpThreadToolUseContent
} from "./schema.js"

type ToolUseLookup = Readonly<Record<string, AmpThreadToolUseContent>>

const isoFromMillis = (timestamp: number): string => DateTime.unsafeMake(timestamp).pipe(DateTime.formatIso)

const timeFromBlock = (block: unknown): Option.Option<number> =>
  Predicate.isRecord(block)
    ? Option.firstSomeOf([
      typeof block.finalTime === "number" ? Option.some(block.finalTime) : Option.none<number>(),
      typeof block.startTime === "number" ? Option.some(block.startTime) : Option.none<number>()
    ])
    : Option.none<number>()

const timestampFor = (options: {
  readonly block: unknown
  readonly fallback: string
  readonly message: AmpThreadMessage
}): string =>
  Option.firstSomeOf([timeFromBlock(options.block), Option.fromNullable(options.message.meta?.sentAt)]).pipe(
    Option.map(isoFromMillis),
    Option.getOrElse(() => options.fallback)
  )

const visibleAssistantContent = (content: ReadonlyArray<AmpThreadContent>) =>
  content.filter((block) => block.type !== "thinking" || block.thinking.length > 0)

const toolUsesFor = (message: AmpThreadMessage): ToolUseLookup =>
  message.content.reduce<ToolUseLookup>(
    (lookup, block) => block.type === "tool_use" ? { ...lookup, [block.id]: block } : lookup,
    {}
  )

const contentTextFrom = (content: unknown): string =>
  Arr.isArray(content)
    ? Arr.join(
      Arr.flatMap(content, (item) =>
        Predicate.isRecord(item) && typeof item.text === "string"
          ? Arr.of(item.text)
          : Arr.empty<string>()),
      "\n\n"
    )
    : ""

const toolResultText = (result: unknown): Option.Option<string> =>
  typeof result === "string"
    ? Option.some(result)
    : Predicate.isRecord(result)
    ? Option.firstSomeOf([
      typeof result.output === "string" ? Option.some(result.output) : Option.none<string>(),
      typeof result.stdout === "string"
        ? Option.some(`${result.stdout}${typeof result.stderr === "string" ? `\n${result.stderr}` : ""}`.trim())
        : Option.none<string>(),
      Arr.isArray(result.content) ? Option.some(contentTextFrom(result.content)) : Option.none<string>()
    ]).pipe(Option.filter((text) => text.length > 0))
    : Option.none<string>()

const toolResultExitCode = (result: unknown): Option.Option<number> =>
  Predicate.isRecord(result) && typeof result.exitCode === "number"
    ? Option.some(result.exitCode)
    : Option.none<number>()

const toolMessageEvent = (options: {
  readonly toolName: string
  readonly toolResult: AmpThreadToolResultContent
  readonly fallback: string
  readonly message: AmpThreadMessage
}): Effect.Effect<ReadonlyArray<OpenAgentTraceEvent>, ParseResult.ParseError> =>
  Effect.gen(function*() {
    const text = toolResultText(options.toolResult.run.result)
    const blocks = yield* normalizeUserBlocks(
      `amp-thread:tool-result:${options.toolResult.toolUseID}`,
      Option.match(text, {
        onNone: () => [{
          type: "tool_result",
          toolUseID: options.toolResult.toolUseID,
          status: options.toolResult.run.status,
          output: ""
        }],
        onSome: (output) => [{ type: "text", text: output }]
      })
    )

    return [
      ampMessageEvent({
        eventId: `amp-thread:tool-result:${options.toolResult.toolUseID}`,
        timestamp: timestampFor({
          block: options.toolResult,
          fallback: options.fallback,
          message: options.message
        }),
        actorKind: "tool",
        role: options.toolName,
        contentBlocks: blocks,
        usage: Option.none()
      })
    ]
  })

/**
 * Projects assistant messages from an Amp thread export into canonical events.
 *
 * @since 0.2.0
 */
export const assistantEventsFor = (options: {
  readonly fallback: string
  readonly message: AmpThreadMessage
}): Effect.Effect<ReadonlyArray<OpenAgentTraceEvent>, ParseResult.ParseError> => {
  const content = visibleAssistantContent(options.message.content)

  return content.length === 0
    ? Effect.succeed([])
    : Effect.map(normalizeAssistantBlocks(`amp-thread:assistant:${options.message.messageId}`, content), (blocks) => [
      ampMessageEvent({
        eventId: `amp-thread:assistant:${options.message.messageId}`,
        timestamp: timestampFor({ block: undefined, fallback: options.fallback, message: options.message }),
        actorKind: "assistant",
        role: "assistant",
        contentBlocks: blocks,
        usage: Option.none()
      })
    ])
}

/**
 * Indexes tool-use blocks from one assistant message by tool-use id.
 *
 * @since 0.2.0
 */
export const toolUsesForMessage = toolUsesFor

/**
 * Projects user messages and tool-result turns from an Amp thread export into canonical events.
 *
 * @since 0.2.0
 */
export const userEventsFor = (options: {
  readonly fallback: string
  readonly message: AmpThreadMessage
  readonly toolUses: ToolUseLookup
}): Effect.Effect<ReadonlyArray<OpenAgentTraceEvent>, ParseResult.ParseError> => {
  const onlyToolResults = options.message.content.every((block) => block.type === "tool_result")

  return onlyToolResults
    ? Effect.map(
      Effect.forEach(
        options.message.content,
        (block) =>
          Option.fromNullable(options.toolUses[block.toolUseID]).pipe(
            Option.match({
              onNone: () =>
                toolMessageEvent({
                  toolName: "tool",
                  toolResult: block,
                  fallback: options.fallback,
                  message: options.message
                }),
              onSome: (toolUse) =>
                shellCommandFromToolUse(toolUse.name, toolUse.input).pipe(
                  Option.match({
                    onNone: () =>
                      toolMessageEvent({
                        toolName: toolUse.name,
                        toolResult: block,
                        fallback: options.fallback,
                        message: options.message
                      }),
                    onSome: (shellCommand) =>
                      Effect.succeed<ReadonlyArray<OpenAgentTraceEvent>>([
                        ampShellRuntimeEvent({
                          eventId: `amp-thread:tool:${block.toolUseID}`,
                          timestamp: timestampFor({
                            block,
                            fallback: options.fallback,
                            message: options.message
                          }),
                          toolName: toolUse.name,
                          command: shellCommand.command,
                          outputText: toolResultText(block.run.result),
                          status: block.run.status === "running" || block.run.status === "pending"
                            ? "error"
                            : block.run.status,
                          isError: Option.none(),
                          exitCode: toolResultExitCode(block.run.result)
                        })
                      ])
                  })
                )
            })
          ),
        { concurrency: 1 }
      ),
      Arr.flatten
    )
    : Effect.map(
      normalizeUserBlocks(`amp-thread:user:${options.message.messageId}`, options.message.content),
      (blocks) => [
        ampMessageEvent({
          eventId: `amp-thread:user:${options.message.messageId}`,
          timestamp: timestampFor({ block: undefined, fallback: options.fallback, message: options.message }),
          actorKind: "user",
          role: "user",
          contentBlocks: blocks,
          usage: Option.none()
        })
      ]
    )
}
