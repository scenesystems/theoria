/**
 * Shared text and event helpers for coding-agent projections.
 *
 * @since 0.2.0
 */
import { Array as Arr, Option, Predicate, Record } from "effect"

import type { FieldRecord } from "../../contracts/FieldValue.js"
import type {
  OpenAgentTraceEvent,
  OpenAgentTraceMessage,
  OpenAgentTraceRecord,
  OpenAgentTraceRuntimeEvent
} from "../schema.js"

type OpenAgentTraceContentBlock = OpenAgentTraceMessage["contentBlocks"][number]

const filePathPattern = /(?:\.{1,2}\/)?(?:[A-Za-z0-9_@.-]+\/)*[A-Za-z0-9_@.-]+\.[A-Za-z0-9_-]+/gu

const trimNonEmpty = (value: string): Option.Option<string> =>
  Option.fromNullable(value.trim()).pipe(Option.filter((text) => text.length > 0))

const textEntry = (eventId: string, text: string): readonly [string, string] => [eventId, text]

const valueText = (value: unknown): ReadonlyArray<string> =>
  Predicate.isRecord(value)
    ? Arr.flatMap(Record.values(value), (nested) => valueText(nested))
    : Arr.isArray(value)
    ? Arr.flatMap(value, (nested) => valueText(nested))
    : typeof value === "string"
    ? Arr.of(value)
    : Arr.empty()

const blockText = (block: OpenAgentTraceContentBlock): string =>
  block.type === "text"
    ? block.text
    : block.type === "thinking"
    ? block.thinking
    : block.type === "json"
    ? Arr.join(valueText(block.data), " ")
    : block.type === "toolCall"
    ? Arr.join(Arr.prepend(valueText(block.arguments), block.toolName), " ")
    : ""

const messageText = (event: OpenAgentTraceMessage): string =>
  Arr.join(Arr.filterMap(event.contentBlocks, (block) => trimNonEmpty(blockText(block))), "\n")

const metadataText = (event: OpenAgentTraceEvent): string =>
  event.eventKind === "custom-message"
    ? Arr.join(
      Arr.filterMap(event.contentBlocks ?? Arr.empty(), (block) => trimNonEmpty(blockText(block))),
      "\n"
    )
    : event.eventKind === "session-info"
    ? event.sessionName ?? ""
    : event.eventKind === "label"
    ? event.label ?? ""
    : event.eventKind === "branch-summary" || event.eventKind === "compaction"
    ? event.summaryText
    : ""

const stableUnique = (values: ReadonlyArray<string>): ReadonlyArray<string> => Arr.dedupe(values)

/**
 * Refines one normalized event to the canonical message-event family.
 *
 * @since 0.2.0
 */
export const isMessageEvent = (event: OpenAgentTraceEvent): event is OpenAgentTraceMessage =>
  event.eventKind === "message"

/**
 * Refines one normalized event to bash execution runtime events.
 *
 * @since 0.2.0
 */
export const isBashExecutionEvent = (event: OpenAgentTraceEvent): event is OpenAgentTraceRuntimeEvent =>
  event.eventKind === "bash-execution"

/**
 * Collapses message-like events to their text payload for downstream projections.
 *
 * @since 0.2.0
 */
export const messageLikeText = (event: OpenAgentTraceEvent): string =>
  isMessageEvent(event) ? messageText(event) : metadataText(event)

/**
 * Selects the instruction-carrying event texts from one normalized record.
 *
 * @since 0.2.0
 */
export const instructionEventTexts = (record: OpenAgentTraceRecord): ReadonlyArray<readonly [string, string]> => {
  const instructionEvents = Arr.filter(record.events, (event) => {
    if (!isMessageEvent(event) && event.eventKind !== "custom-message") {
      return false
    }

    const actorKind = event.actor?.actorKind

    return actorKind === "user" || actorKind === "system" || actorKind === "custom"
  })
  const selected = Arr.map(
    instructionEvents.length > 0
      ? instructionEvents
      : Arr.filter(record.events, (event) => isMessageEvent(event) || event.eventKind === "custom-message"),
    (event) => textEntry(event.eventId, messageLikeText(event))
  )

  return Arr.filterMap(
    selected,
    ([eventId, text]) => trimNonEmpty(text).pipe(Option.map((nonEmptyText) => textEntry(eventId, nonEmptyText)))
  )
}

/**
 * Returns bash execution events in record order.
 *
 * @since 0.2.0
 */
export const bashExecutionEvents = (record: OpenAgentTraceRecord): ReadonlyArray<OpenAgentTraceRuntimeEvent> =>
  Arr.filter(record.events, isBashExecutionEvent)

const isAssistantMessage = (event: OpenAgentTraceEvent): event is OpenAgentTraceMessage =>
  isMessageEvent(event) && event.actor.actorKind === "assistant"

/**
 * Returns assistant-authored message events in record order.
 *
 * @since 0.2.0
 */
export const assistantMessages = (record: OpenAgentTraceRecord): ReadonlyArray<OpenAgentTraceMessage> =>
  Arr.filter(record.events, isAssistantMessage)

/**
 * Extracts stable tool names mentioned across one normalized record.
 *
 * @since 0.2.0
 */
export const toolNamesFromRecord = (record: OpenAgentTraceRecord): ReadonlyArray<string> =>
  stableUnique(
    Arr.flatMap(record.events, (event) => {
      const actorToolNames = "actor" in event
        ? Option.fromNullable(event.actor?.toolName).pipe(
          Option.match({ onNone: () => Arr.empty<string>(), onSome: Arr.of })
        )
        : Arr.empty<string>()
      const blockToolNames = isMessageEvent(event)
        ? Arr.flatMap(
          event.contentBlocks,
          (block) => (block.type === "toolCall" ? Arr.of(block.toolName) : Arr.empty<string>())
        )
        : event.eventKind === "custom-message"
        ? Arr.flatMap(event.contentBlocks ?? Arr.empty(), (block) =>
          block.type === "toolCall" ? Arr.of(block.toolName) : Arr.empty<string>())
        : Arr.empty<string>()

      return Arr.appendAll(actorToolNames, blockToolNames)
    })
  )

/**
 * Extracts stable file-path tokens from free-form text.
 *
 * @since 0.2.0
 */
export const filePathsFromText = (text: string): ReadonlyArray<string> =>
  stableUnique(text.match(filePathPattern) ?? Arr.empty())

/**
 * Extracts stable file-path tokens from a field-record payload.
 *
 * @since 0.2.0
 */
export const filePathsFromFieldRecord = (value: FieldRecord): ReadonlyArray<string> =>
  stableUnique(Arr.flatMap(valueText(value), filePathsFromText))

/**
 * Deduplicates strings while preserving first-seen order.
 *
 * @since 0.2.0
 */
export const stableUniqueStrings = stableUnique

/**
 * Returns the first non-empty trimmed line from a text payload.
 *
 * @since 0.2.0
 */
export const firstTextLine = (text: string): string =>
  Option.getOrElse(
    Arr.findFirst(text.split(/\r?\n/u), (line) => line.trim().length > 0).pipe(Option.map((line) => line.trim())),
    () => text.trim()
  )

/**
 * Produces a short summary string from the first meaningful text line.
 *
 * @since 0.2.0
 */
export const summaryText = (text: string): string => firstTextLine(text).slice(0, 160)

/**
 * Normalizes text for case-insensitive matching.
 *
 * @since 0.2.0
 */
export const lowerCase = (text: string): string => text.toLowerCase()

/**
 * Splits text into stable line and sentence-like units.
 *
 * @since 0.2.0
 */
export const splitTextUnits = (text: string): ReadonlyArray<string> =>
  stableUnique(
    Arr.filterMap(
      text
        .split(/\r?\n/u)
        .flatMap((line) => line.split(/(?<=[.!?])\s+/u)),
      trimNonEmpty
    )
  )

/**
 * Flattens nested field-record payloads to their string fragments.
 *
 * @since 0.2.0
 */
export const recordText = valueText
