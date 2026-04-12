import { Match } from "effect"
import * as Option from "effect/Option"

import type { PresentationDetailRow } from "../../../presentation/detail-row.js"
import { presentationDetailRow } from "../../../presentation/detail-row.js"
import {
  type MessageContent,
  MessageDataContent,
  type MessageModel,
  MessageModel as MessageModelSchema,
  type MessageRole,
  type MessageStatus,
  MessageTextContent
} from "../../../presentation/interactions.js"

import { compact, encodeJsonText, messageActor, messageAlignmentFor, timestampLabel } from "./message-panel-shared.js"
import type { OpenAgentTraceRecord } from "./study-material.js"

type OpenAgentTraceEvent = OpenAgentTraceRecord["events"][number]
type OpenAgentTraceMessageEvent = Extract<OpenAgentTraceEvent, { readonly eventKind: "message" }>
type OpenAgentTraceContentBlock = OpenAgentTraceMessageEvent["contentBlocks"][number]

const messageRoleFor = (actorKind: OpenAgentTraceMessageEvent["actor"]["actorKind"]): MessageRole =>
  Match.value(actorKind).pipe(
    Match.withReturnType<MessageRole>(),
    Match.when("user", () => "user"),
    Match.when("assistant", () => "assistant"),
    Match.when("system", () => "system"),
    Match.when("tool", () => "tool"),
    Match.when("runtime", () => "runtime"),
    Match.when("custom", () => "custom"),
    Match.exhaustive
  )

const messageLabelFor = (event: OpenAgentTraceMessageEvent): string =>
  event.actor.toolName ?? event.actor.model ?? event.actor.provider ?? event.actor.role

const contentFor = (block: OpenAgentTraceContentBlock): ReadonlyArray<MessageContent> =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }) => [MessageTextContent.make({ kind: "body", text })]),
    Match.when({ type: "thinking" }, ({ thinking }) => [MessageTextContent.make({ kind: "thinking", text: thinking })]),
    Match.when({ type: "image" }, ({ contentDigest, mimeType }) => [
      MessageDataContent.make({
        display: "rows",
        rows: [
          presentationDetailRow("image", mimeType),
          presentationDetailRow("digest", compact(`${contentDigest.algorithm}:${contentDigest.digest}`, 72))
        ],
        title: "Image"
      })
    ]),
    Match.when({ type: "json" }, ({ data }) => [
      MessageDataContent.make({
        display: "json",
        rows: [presentationDetailRow("payload", compact(encodeJsonText(data)))],
        title: "JSON"
      })
    ]),
    Match.when({ type: "toolCall" }, ({ arguments: input, toolCallId, toolName }) => [
      MessageDataContent.make({
        display: "json",
        rows: [
          presentationDetailRow("tool call", toolCallId),
          presentationDetailRow("arguments", compact(encodeJsonText(input)))
        ],
        title: toolName
      })
    ]),
    Match.exhaustive
  )

const systemMessage = ({
  eventId,
  label,
  role,
  rows,
  status = "default",
  supportingText,
  timestamp,
  title
}: {
  readonly eventId: string
  readonly label: string
  readonly role: MessageRole
  readonly rows: ReadonlyArray<PresentationDetailRow>
  readonly status?: MessageStatus
  readonly supportingText?: string
  readonly timestamp: string
  readonly title?: string
}): MessageModel =>
  MessageModelSchema.make({
    actor: messageActor({
      label,
      role,
      ...Option.match(Option.fromNullable(supportingText), {
        onNone: () => ({}),
        onSome: (resolvedSupportingText) => ({ supportingText: resolvedSupportingText })
      })
    }),
    alignment: messageAlignmentFor(role),
    blocks: [MessageDataContent.make({
      display: "rows",
      rows,
      ...Option.match(Option.fromNullable(title), {
        onNone: () => ({}),
        onSome: (resolvedTitle) => ({ title: resolvedTitle })
      })
    })],
    id: eventId,
    status,
    timestampLabel: timestampLabel(timestamp)
  })

export const messageForEvent = (event: OpenAgentTraceEvent): MessageModel =>
  Match.value(event).pipe(
    Match.when({ eventKind: "message" }, (messageEvent) => {
      const role = messageRoleFor(messageEvent.actor.actorKind)
      const errorMessage = Option.fromNullable(messageEvent.errorMessage)
      const status: MessageStatus = Option.match(errorMessage, {
        onNone: () => "default",
        onSome: () => "error"
      })

      return MessageModelSchema.make({
        actor: messageActor({
          label: messageLabelFor(messageEvent),
          role,
          ...Option.match(Option.fromNullable(messageEvent.piTurnProvenance?.model), {
            onNone: () => ({}),
            onSome: (supportingText) => ({ supportingText })
          })
        }),
        alignment: messageAlignmentFor(role),
        blocks: Option.match(errorMessage, {
          onNone: () => messageEvent.contentBlocks.flatMap(contentFor),
          onSome: (resolvedErrorMessage) => [
            ...messageEvent.contentBlocks.flatMap(contentFor),
            MessageDataContent.make({
              display: "rows",
              rows: [presentationDetailRow("error", compact(resolvedErrorMessage))],
              title: "Execution Error"
            })
          ]
        }),
        id: messageEvent.eventId,
        status,
        timestampLabel: timestampLabel(messageEvent.timestamp)
      })
    }),
    Match.when({ eventKind: "bash-execution" }, ({ command, eventId, outputText, timestamp }) =>
      systemMessage({
        eventId,
        label: "Shell",
        role: "tool",
        rows: [
          presentationDetailRow("command", compact(Option.getOrElse(Option.fromNullable(command), () => "n/a"))),
          presentationDetailRow("output", compact(Option.getOrElse(Option.fromNullable(outputText), () => "n/a")))
        ],
        timestamp,
        title: "Tool Call"
      })),
    Match.when({ eventKind: "model-change" }, ({ eventId, modelId, timestamp }) =>
      systemMessage({
        eventId,
        label: "Runtime",
        role: "runtime",
        rows: [presentationDetailRow("model", Option.getOrElse(Option.fromNullable(modelId), () => "n/a"))],
        supportingText: "model change",
        timestamp,
        title: "Runtime Event"
      })),
    Match.when({ eventKind: "thinking-level-change" }, ({ eventId, thinkingLevel, timestamp }) =>
      systemMessage({
        eventId,
        label: "Runtime",
        role: "runtime",
        rows: [
          presentationDetailRow("thinking level", Option.getOrElse(Option.fromNullable(thinkingLevel), () => "n/a"))
        ],
        supportingText: "reasoning change",
        timestamp,
        title: "Runtime Event"
      })),
    Match.when({ eventKind: "compaction" }, ({ eventId, firstKeptEntryId, summaryText, timestamp }) =>
      systemMessage({
        eventId,
        label: "System",
        role: "system",
        rows: [
          presentationDetailRow("summary", compact(summaryText)),
          presentationDetailRow("kept from", Option.getOrElse(Option.fromNullable(firstKeptEntryId), () => "n/a"))
        ],
        supportingText: "compaction",
        timestamp,
        title: "Summary"
      })),
    Match.when({ eventKind: "branch-summary" }, ({ eventId, summaryText, timestamp }) =>
      systemMessage({
        eventId,
        label: "System",
        role: "system",
        rows: [presentationDetailRow("summary", compact(summaryText))],
        supportingText: "branch summary",
        timestamp,
        title: "Summary"
      })),
    Match.orElse((metadataEvent) => {
      const actor = Option.fromNullable(metadataEvent.actor)
      const label = Option.getOrElse(
        Option.orElse(Option.map(actor, ({ role }) => role), () => Option.fromNullable(metadataEvent.label)),
        () => "Metadata"
      )
      const role: MessageRole = Option.match(actor, {
        onNone: () => "custom",
        onSome: ({ actorKind }) => messageRoleFor(actorKind)
      })
      const contentBlocks = Option.fromNullable(metadataEvent.contentBlocks)

      return MessageModelSchema.make({
        actor: messageActor({ label, role }),
        alignment: messageAlignmentFor(role),
        blocks: Option.match(contentBlocks, {
          onNone: () => [MessageDataContent.make({
            display: "rows",
            rows: [
              presentationDetailRow("event", metadataEvent.eventKind),
              presentationDetailRow("record", metadataEvent.eventId)
            ],
            title: metadataEvent.label ?? metadataEvent.eventKind
          })],
          onSome: (resolvedContentBlocks) => resolvedContentBlocks.flatMap(contentFor)
        }),
        id: metadataEvent.eventId,
        status: "default",
        timestampLabel: timestampLabel(metadataEvent.timestamp)
      })
    })
  )
