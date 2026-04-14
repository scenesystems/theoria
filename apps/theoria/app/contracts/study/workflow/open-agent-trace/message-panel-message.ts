import { Match } from "effect"
import * as Option from "effect/Option"

import { presentationDetailRow } from "../../../presentation/detail-row.js"
import {
  ActionModel,
  InteractionActionItem,
  InteractionMessageItem,
  type MessageActorModel,
  type MessageAlignment,
  type MessageContent,
  MessageDetailsContent,
  type MessageModel,
  MessageModel as MessageModelSchema,
  MessagePayloadContent,
  type MessageRole,
  type MessageStatus,
  MessageTextContent,
  PayloadModel
} from "../../../presentation/interactions.js"

import { compact, encodeJsonText, messageActor, messageAlignmentFor, timestampLabel } from "./message-panel-shared.js"
import type { OpenAgentTraceRecord } from "./study-material.js"

type OpenAgentTraceEvent = OpenAgentTraceRecord["events"][number]
type OpenAgentTraceMessageEvent = Extract<OpenAgentTraceEvent, { eventKind: "message" }>
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

const payload = ({
  format,
  payload,
  title
}: {
  readonly format: "plain" | "json"
  readonly payload: string
  readonly title?: string
}): PayloadModel =>
  PayloadModel.make({
    format,
    payload,
    ...Option.match(Option.fromNullable(title), {
      onNone: () => ({}),
      onSome: (resolvedTitle) => ({ title: resolvedTitle })
    })
  })

const actionItem = ({
  action,
  actor,
  alignment,
  id,
  timestampLabel
}: {
  readonly action: ActionModel
  readonly actor: MessageActorModel
  readonly alignment: MessageAlignment
  readonly id: string
  readonly timestampLabel?: string
}): InteractionActionItem =>
  InteractionActionItem.make({
    action,
    actor,
    alignment,
    id,
    ...Option.match(Option.fromNullable(timestampLabel), {
      onNone: () => ({}),
      onSome: (resolvedTimestampLabel) => ({ timestampLabel: resolvedTimestampLabel })
    })
  })

const commandStatus = ({
  cancelled,
  exitCode
}: {
  readonly cancelled: Option.Option<boolean>
  readonly exitCode: Option.Option<number>
}): "default" | "error" | "success" =>
  Option.getOrElse(cancelled, () => false) === true
    ? "error"
    : Option.match(exitCode, {
      onNone: () => "default",
      onSome: (resolvedExitCode) => resolvedExitCode === 0 ? "success" : "error"
    })

const contentFor = (block: OpenAgentTraceContentBlock): ReadonlyArray<MessageContent> =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }) => [MessageTextContent.make({ kind: "body", text })]),
    Match.when({ type: "thinking" }, ({ thinking }) => [MessageTextContent.make({ kind: "thinking", text: thinking })]),
    Match.when({ type: "image" }, ({ contentDigest, mimeType }) => [
      MessageDetailsContent.make({
        rows: [
          presentationDetailRow("image", mimeType),
          presentationDetailRow("digest", compact(`${contentDigest.algorithm}:${contentDigest.digest}`, 72))
        ],
        title: "Image"
      })
    ]),
    Match.when({ type: "json" }, ({ data }) => [
      MessagePayloadContent.make({
        payload: payload({
          format: "json",
          payload: compact(encodeJsonText(data), 480),
          title: "JSON"
        })
      })
    ]),
    Match.when({ type: "toolCall" }, () => []),
    Match.exhaustive
  )

const toolActionItem = ({
  block,
  index,
  timestamp
}: {
  readonly block: Extract<OpenAgentTraceContentBlock, { readonly type: "toolCall" }>
  readonly index: number
  readonly timestamp: string
}): InteractionActionItem =>
  actionItem({
    action: ActionModel.make({
      callId: block.toolCallId,
      details: [],
      id: `${block.toolCallId}:${index}`,
      input: payload({
        format: "json",
        payload: compact(encodeJsonText(block.arguments), 480),
        title: "Arguments"
      }),
      kind: "tool",
      label: block.toolName,
      status: "default",
      supportingText: "tool call"
    }),
    actor: messageActor({ label: "Tool", role: "tool" }),
    alignment: messageAlignmentFor("tool"),
    id: `${block.toolCallId}:${index}`,
    timestampLabel: timestampLabel(timestamp)
  })

const eventMessage = ({
  content,
  eventId,
  label,
  role,
  status = "default",
  supportingText,
  timestamp
}: {
  readonly content: ReadonlyArray<MessageContent>
  readonly eventId: string
  readonly label: string
  readonly role: MessageRole
  readonly status?: MessageStatus
  readonly supportingText?: string
  readonly timestamp: string
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
    content,
    id: eventId,
    status,
    timestampLabel: timestampLabel(timestamp)
  })

const flushPendingMessage = ({
  content,
  eventId,
  label,
  role,
  sliceIndex,
  status,
  supportingText,
  timestamp
}: {
  readonly content: ReadonlyArray<MessageContent>
  readonly eventId: string
  readonly label: string
  readonly role: MessageRole
  readonly sliceIndex: number
  readonly status: MessageStatus
  readonly supportingText?: string
  readonly timestamp: string
}): ReadonlyArray<InteractionMessageItem> =>
  content.length === 0
    ? []
    : [InteractionMessageItem.make({
      message: eventMessage({
        content,
        eventId: sliceIndex === 0 ? eventId : `${eventId}:message:${sliceIndex}`,
        label,
        role,
        status,
        ...Option.match(Option.fromNullable(supportingText), {
          onNone: () => ({}),
          onSome: (resolvedSupportingText) => ({ supportingText: resolvedSupportingText })
        }),
        timestamp
      })
    })]

const interactionItemsForContentBlocks = ({
  blocks,
  eventId,
  label,
  role,
  status,
  supportingText,
  timestamp,
  trailingContent
}: {
  readonly blocks: ReadonlyArray<OpenAgentTraceContentBlock>
  readonly eventId: string
  readonly label: string
  readonly role: MessageRole
  readonly status: MessageStatus
  readonly supportingText?: string
  readonly timestamp: string
  readonly trailingContent?: ReadonlyArray<MessageContent>
}): ReadonlyArray<InteractionActionItem | InteractionMessageItem> => {
  const initialState: {
    readonly items: ReadonlyArray<InteractionActionItem | InteractionMessageItem>
    readonly pending: ReadonlyArray<MessageContent>
    readonly sliceIndex: number
  } = {
    items: [],
    pending: [],
    sliceIndex: 0
  }

  const reduced = blocks.reduce(
    (state, block, index) =>
      Match.value(block).pipe(
        Match.when({ type: "toolCall" }, (toolCallBlock) => ({
          items: [
            ...state.items,
            ...flushPendingMessage({
              content: state.pending,
              eventId,
              label,
              role,
              sliceIndex: state.sliceIndex,
              status,
              ...Option.match(Option.fromNullable(supportingText), {
                onNone: () => ({}),
                onSome: (resolvedSupportingText) => ({ supportingText: resolvedSupportingText })
              }),
              timestamp
            }),
            toolActionItem({ block: toolCallBlock, index, timestamp })
          ],
          pending: [],
          sliceIndex: state.sliceIndex + 1
        })),
        Match.orElse((contentBlock) => ({
          items: state.items,
          pending: [...state.pending, ...contentFor(contentBlock)],
          sliceIndex: state.sliceIndex
        }))
      ),
    initialState
  )

  const finalPending = [
    ...reduced.pending,
    ...Option.getOrElse(Option.fromNullable(trailingContent), (): ReadonlyArray<MessageContent> => [])
  ]

  return [
    ...reduced.items,
    ...flushPendingMessage({
      content: finalPending,
      eventId,
      label,
      role,
      sliceIndex: reduced.sliceIndex,
      status,
      ...Option.match(Option.fromNullable(supportingText), {
        onNone: () => ({}),
        onSome: (resolvedSupportingText) => ({ supportingText: resolvedSupportingText })
      }),
      timestamp
    })
  ]
}

export const interactionItemsForEvent = (
  event: OpenAgentTraceEvent
): ReadonlyArray<InteractionActionItem | InteractionMessageItem> =>
  Match.value(event).pipe(
    Match.when({ eventKind: "message" }, (messageEvent) => {
      const role = messageRoleFor(messageEvent.actor.actorKind)
      const errorMessage = Option.fromNullable(messageEvent.errorMessage)
      const status: MessageStatus = Option.match(errorMessage, {
        onNone: () => "default",
        onSome: () => "error"
      })

      return interactionItemsForContentBlocks({
        blocks: messageEvent.contentBlocks,
        eventId: messageEvent.eventId,
        label: messageLabelFor(messageEvent),
        role,
        status,
        ...Option.match(Option.fromNullable(messageEvent.piTurnProvenance?.model), {
          onNone: () => ({}),
          onSome: (supportingText) => ({ supportingText })
        }),
        timestamp: messageEvent.timestamp,
        trailingContent: Option.match(errorMessage, {
          onNone: () => [],
          onSome: (resolvedErrorMessage) => [MessagePayloadContent.make({
            payload: payload({
              format: "plain",
              payload: compact(resolvedErrorMessage, 360),
              title: "Execution Error"
            })
          })]
        })
      })
    }),
    Match.when(
      { eventKind: "bash-execution" },
      ({ cancelled, command, eventId, exitCode, outputText, timestamp, truncated }) => [actionItem({
        action: ActionModel.make({
          details: [
            presentationDetailRow(
              "exit code",
              String(Option.getOrElse(Option.fromNullable(exitCode), () => -1))
            ),
            presentationDetailRow("cancelled", cancelled === true ? "yes" : "no"),
            presentationDetailRow("truncated", truncated === true ? "yes" : "no")
          ],
          id: eventId,
          input: payload({
            format: "plain",
            payload: compact(Option.getOrElse(Option.fromNullable(command), () => "n/a"), 280),
            title: "Command"
          }),
          kind: "command",
          label: "Shell Execution",
          output: payload({
            format: "plain",
            payload: compact(Option.getOrElse(Option.fromNullable(outputText), () => "n/a"), 520),
            title: "Output"
          }),
          status: commandStatus({
            cancelled: Option.fromNullable(cancelled),
            exitCode: Option.fromNullable(exitCode)
          }),
          supportingText: "shell command"
        }),
        actor: messageActor({ label: "Shell", role: "tool" }),
        alignment: messageAlignmentFor("tool"),
        id: eventId,
        timestampLabel: timestampLabel(timestamp)
      })]
    ),
    Match.when({ eventKind: "model-change" }, ({ eventId, modelId, timestamp }) => [actionItem({
      action: ActionModel.make({
        details: [presentationDetailRow("model", Option.getOrElse(Option.fromNullable(modelId), () => "n/a"))],
        id: eventId,
        kind: "runtime",
        label: "Model Change",
        status: "default",
        supportingText: "runtime event"
      }),
      actor: messageActor({ label: "Runtime", role: "runtime" }),
      alignment: messageAlignmentFor("runtime"),
      id: eventId,
      timestampLabel: timestampLabel(timestamp)
    })]),
    Match.when({ eventKind: "thinking-level-change" }, ({ eventId, thinkingLevel, timestamp }) => [actionItem({
      action: ActionModel.make({
        details: [
          presentationDetailRow("thinking level", Option.getOrElse(Option.fromNullable(thinkingLevel), () => "n/a"))
        ],
        id: eventId,
        kind: "runtime",
        label: "Reasoning Level",
        status: "default",
        supportingText: "runtime event"
      }),
      actor: messageActor({ label: "Runtime", role: "runtime" }),
      alignment: messageAlignmentFor("runtime"),
      id: eventId,
      timestampLabel: timestampLabel(timestamp)
    })]),
    Match.when(
      { eventKind: "compaction" },
      ({ eventId, firstKeptEntryId, summaryText, timestamp }) => [InteractionMessageItem.make({
        message: eventMessage({
          content: [
            MessageTextContent.make({ kind: "body", text: compact(summaryText, 320) }),
            MessageDetailsContent.make({
              rows: [
                presentationDetailRow("kept from", Option.getOrElse(Option.fromNullable(firstKeptEntryId), () => "n/a"))
              ],
              title: "Summary"
            })
          ],
          eventId,
          label: "System",
          role: "system",
          supportingText: "compaction",
          timestamp
        })
      })]
    ),
    Match.when({ eventKind: "branch-summary" }, ({ eventId, summaryText, timestamp }) => [InteractionMessageItem.make({
      message: eventMessage({
        content: [MessageTextContent.make({ kind: "body", text: compact(summaryText, 320) })],
        eventId,
        label: "System",
        role: "system",
        supportingText: "branch summary",
        timestamp
      })
    })]),
    Match.when({ eventKind: "custom-message" }, (metadataEvent) => {
      const actor = Option.fromNullable(metadataEvent.actor)
      const label = Option.getOrElse(
        Option.orElse(Option.map(actor, ({ role }) => role), () => Option.fromNullable(metadataEvent.label)),
        () => "Metadata"
      )
      const role: MessageRole = Option.match(actor, {
        onNone: () => "custom",
        onSome: ({ actorKind }) => messageRoleFor(actorKind)
      })

      return interactionItemsForContentBlocks({
        blocks: Option.getOrElse(Option.fromNullable(metadataEvent.contentBlocks), () => []),
        eventId: metadataEvent.eventId,
        label,
        role,
        status: "default",
        timestamp: metadataEvent.timestamp
      })
    }),
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
      return [InteractionMessageItem.make({
        message: MessageModelSchema.make({
          actor: messageActor({ label, role }),
          alignment: messageAlignmentFor(role),
          content: [MessageDetailsContent.make({
            rows: [
              presentationDetailRow("event", metadataEvent.eventKind),
              presentationDetailRow("record", metadataEvent.eventId)
            ],
            title: metadataEvent.label ?? metadataEvent.eventKind
          })],
          id: metadataEvent.eventId,
          status: "default",
          timestampLabel: timestampLabel(metadataEvent.timestamp)
        })
      })]
    })
  )
