import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import type {
  OpenAgentTraceRecord,
  OpenAgentTraceRegistryEntry
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import type { DetailItem } from "./panel-types.js"

type OpenAgentTraceEvent = OpenAgentTraceRecord["events"][number]
type OpenAgentTraceMessageEvent = Extract<OpenAgentTraceEvent, { readonly eventKind: "message" }>
type OpenAgentTraceSummaryEvent = Extract<
  OpenAgentTraceEvent,
  { readonly eventKind: "compaction" | "branch-summary" }
>
type OpenAgentTraceRuntimeEvent = Extract<
  OpenAgentTraceEvent,
  { readonly eventKind: "model-change" | "thinking-level-change" | "bash-execution" }
>
type OpenAgentTraceMetadataEvent = Extract<
  OpenAgentTraceEvent,
  { readonly eventKind: "custom" | "custom-message" | "label" | "session-info" }
>
type OpenAgentTraceContentBlock = OpenAgentTraceMessageEvent["contentBlocks"][number]
type OpenAgentTraceTextBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "text" }>
type OpenAgentTraceThinkingBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "thinking" }>
type OpenAgentTraceImageBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "image" }>
type OpenAgentTraceToolCallBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "toolCall" }>
type OpenAgentTraceJsonBlock = Extract<OpenAgentTraceContentBlock, { readonly type: "json" }>

const compact = (text: string, max = 140): string => text.length > max ? `${text.slice(0, max).trimEnd()}…` : text

const joinParts = (parts: ReadonlyArray<string>): string =>
  Arr.join(Arr.filter(parts, (part) => part.trim().length > 0), " · ")

const blockText = (block: OpenAgentTraceContentBlock): string =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }: OpenAgentTraceTextBlock) => text),
    Match.when({ type: "thinking" }, ({ thinking }: OpenAgentTraceThinkingBlock) => `[thinking] ${thinking}`),
    Match.when({ type: "image" }, ({ mimeType }: OpenAgentTraceImageBlock) => `[image:${mimeType}]`),
    Match.when({ type: "toolCall" }, ({ toolName }: OpenAgentTraceToolCallBlock) => `[tool:${toolName}]`),
    Match.when({ type: "json" }, (_: OpenAgentTraceJsonBlock) => "[json block]"),
    Match.exhaustive
  )

const messageDetail = (event: OpenAgentTraceMessageEvent): string =>
  compact(
    joinParts([
      joinParts(event.contentBlocks.map(blockText)),
      ...Option.match(Option.fromNullable(event.piTurnProvenance?.model), {
        onNone: () => [],
        onSome: (model) => [`model ${model}`]
      }),
      ...Option.match(Option.fromNullable(event.errorMessage), {
        onNone: () => [],
        onSome: (errorMessage) => [`error ${errorMessage}`]
      })
    ])
  )

const runtimeDetail = (event: OpenAgentTraceRuntimeEvent): string =>
  compact(
    joinParts([
      ...Option.match(Option.fromNullable(event.modelId), {
        onNone: () => [],
        onSome: (modelId) => [String(modelId)]
      }),
      ...Option.match(Option.fromNullable(event.thinkingLevel), {
        onNone: () => [],
        onSome: (thinkingLevel) => [String(thinkingLevel)]
      }),
      ...Option.match(Option.fromNullable(event.command), {
        onNone: () => [],
        onSome: (command) => [String(command)]
      }),
      ...Option.match(Option.fromNullable(event.outputText), {
        onNone: () => [],
        onSome: (outputText) => [String(outputText)]
      })
    ])
  )

const metadataDetail = (event: OpenAgentTraceMetadataEvent): string =>
  compact(
    joinParts([
      ...Option.match(Option.fromNullable(event.label), {
        onNone: () => [],
        onSome: (label) => [label]
      }),
      ...Option.match(Option.fromNullable(event.sessionName), {
        onNone: () => [],
        onSome: (sessionName) => [sessionName]
      }),
      ...Option.match(Option.fromNullable(event.contentBlocks), {
        onNone: () => [],
        onSome: (contentBlocks) => [joinParts(contentBlocks.map(blockText))]
      })
    ])
  )

const summaryEventDetail = (event: OpenAgentTraceSummaryEvent): string =>
  Match.value(event).pipe(
    Match.when({ eventKind: "compaction" }, ({ firstKeptEntryId, summaryText }) =>
      compact(
        joinParts([
          summaryText,
          ...Option.match(Option.fromNullable(firstKeptEntryId), {
            onNone: () => [],
            onSome: (entryId) => [`kept from ${entryId}`]
          })
        ])
      )),
    Match.when({ eventKind: "branch-summary" }, ({ summaryText }) => compact(summaryText)),
    Match.exhaustive
  )

export const traceEventItemsFor = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<DetailItem> =>
  entry.record.events.map((event) =>
    Match.value(event).pipe(
      Match.when({ eventKind: "message" }, (value: OpenAgentTraceMessageEvent) => ({
        label: `${value.actor.role} · ${value.eventId}`,
        detail: messageDetail(value)
      })),
      Match.when({ eventKind: "compaction" }, (value) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: summaryEventDetail(value)
      })),
      Match.when({ eventKind: "branch-summary" }, (value) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: summaryEventDetail(value)
      })),
      Match.when({ eventKind: "model-change" }, (value: OpenAgentTraceRuntimeEvent) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: runtimeDetail(value)
      })),
      Match.when({ eventKind: "thinking-level-change" }, (value: OpenAgentTraceRuntimeEvent) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: runtimeDetail(value)
      })),
      Match.when({ eventKind: "bash-execution" }, (value: OpenAgentTraceRuntimeEvent) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: runtimeDetail(value)
      })),
      Match.when({ eventKind: "custom" }, (value: OpenAgentTraceMetadataEvent) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: metadataDetail(value)
      })),
      Match.when({ eventKind: "custom-message" }, (value: OpenAgentTraceMetadataEvent) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: metadataDetail(value)
      })),
      Match.when({ eventKind: "label" }, (value: OpenAgentTraceMetadataEvent) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: metadataDetail(value)
      })),
      Match.when({ eventKind: "session-info" }, (value: OpenAgentTraceMetadataEvent) => ({
        label: `${value.eventKind} · ${value.eventId}`,
        detail: metadataDetail(value)
      })),
      Match.exhaustive
    )
  )
