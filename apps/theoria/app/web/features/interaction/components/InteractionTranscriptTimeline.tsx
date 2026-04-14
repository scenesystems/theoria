import { HashSet, Match } from "effect"

import type {
  InteractionItem,
  InteractionSurfaceModel,
  MessageContent
} from "../../../../contracts/presentation/interactions.js"
import { DetailList } from "../../../ui/components/detail/DetailList.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { EmptyState } from "../../../ui/components/feedback/EmptyState.js"
import { TranscriptAction } from "../../../ui/components/transcript/TranscriptAction.js"
import { TranscriptDetailBlock } from "../../../ui/components/transcript/TranscriptDetailBlock.js"
import { TranscriptMessage } from "../../../ui/components/transcript/TranscriptMessage.js"
import { TranscriptPayload } from "../../../ui/components/transcript/TranscriptPayload.js"
import { TranscriptSelectionState } from "../../../ui/components/transcript/TranscriptSelectionState.js"
import { TranscriptTurn } from "../../../ui/components/transcript/TranscriptTurn.js"
import { TranscriptTurnMarker } from "../../../ui/components/transcript/TranscriptTurnMarker.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import {
  interactionActionStatusTone,
  interactionItemId,
  interactionMessageStatusTone,
  interactionRoleTone
} from "../model.js"

const messageContentNode = (content: MessageContent) =>
  Match.value(content).pipe(
    Match.tag(
      "MessageTextContent",
      ({ kind, text }) => <SemanticText role={kind === "body" ? "body" : "body-sm"}>{text}</SemanticText>
    ),
    Match.tag("MessageDetailsContent", ({ rows, title }) => (
      <TranscriptDetailBlock label={title ?? "Details"}>
        <DetailList items={rows.map((row) => ({ label: row.label, value: row.value }))} />
      </TranscriptDetailBlock>
    )),
    Match.tag("MessagePayloadContent", ({ payload }) => (
      <TranscriptDetailBlock label={payload.title ?? "Payload"}>
        <TranscriptPayload code={payload.payload} label={payload.title ?? "Payload"} meta={payload.format} />
      </TranscriptDetailBlock>
    )),
    Match.exhaustive
  )

const selectionBadges = ({
  annotated,
  objective
}: {
  readonly annotated: boolean
  readonly objective: boolean
}) => (
  <>
    {annotated ? <TranscriptSelectionState label="annotated" /> : null}
    {objective ? <TranscriptSelectionState active={false} label="objective" /> : null}
  </>
)

const messageTone = (item: InteractionItem): "default" | "runtime" | "tool" =>
  item._tag === "InteractionMessageItem"
    ? item.message.actor.role === "runtime"
      ? "runtime"
      : item.message.actor.role === "tool"
      ? "tool"
      : "default"
    : item.action.kind === "runtime"
    ? "runtime"
    : item.action.kind === "tool" || item.action.kind === "command"
    ? "tool"
    : "default"

export const InteractionTranscriptTimeline = ({
  annotatedItemIds,
  objectiveItemIds,
  onSelectItem,
  selectedItemId,
  surface,
  transcriptEntryId
}: {
  readonly annotatedItemIds: HashSet.HashSet<string>
  readonly objectiveItemIds: HashSet.HashSet<string>
  readonly onSelectItem: (itemId: string, turnId: string, item: InteractionItem) => void
  readonly selectedItemId: string | null
  readonly surface: InteractionSurfaceModel
  readonly transcriptEntryId: string
}) =>
  surface.turns.length === 0
    ? (
      <EmptyState
        description={surface.emptyText}
        eyebrow="Transcript"
        title="No normalized interaction turns"
      />
    )
    : (
      <Stack gap="md">
        {surface.turns.map((turn, index) => (
          <TranscriptTurn
            key={`${transcriptEntryId}:${turn.id}`}
            marker={
              <TranscriptTurnMarker
                label={String(index + 1).padStart(2, "0")}
                meta={`${turn.items.length} item${turn.items.length === 1 ? "" : "s"}`}
              />
            }
          >
            {turn.items.map((item) => {
              const itemId = interactionItemId(item)
              const badges = selectionBadges({
                annotated: HashSet.has(annotatedItemIds, itemId),
                objective: HashSet.has(objectiveItemIds, itemId)
              })

              return Match.value(item).pipe(
                Match.tag("InteractionMessageItem", ({ message }) => (
                  <TranscriptMessage
                    actor={message.actor.label}
                    align={message.alignment}
                    badges={
                      <>
                        <Badge tone={interactionRoleTone(message.actor.role)}>{message.actor.role}</Badge>
                        {message.status === "default"
                          ? null
                          : <Badge tone={interactionMessageStatusTone(message.status)}>{message.status}</Badge>}
                        {badges}
                      </>
                    }
                    key={message.id}
                    meta={message.timestampLabel}
                    onSelect={() => {
                      onSelectItem(itemId, turn.id, item)
                    }}
                    selected={selectedItemId === itemId}
                    supportingText={message.actor.supportingText}
                    tone={messageTone(item)}
                  >
                    <Stack gap="sm">
                      {message.content.map((content, contentIndex) => (
                        <Stack gap="sm" key={`${message.id}:${String(contentIndex)}`}>
                          {messageContentNode(content)}
                        </Stack>
                      ))}
                    </Stack>
                  </TranscriptMessage>
                )),
                Match.tag("InteractionActionItem", ({ action, actor, alignment, timestampLabel }) => (
                  <TranscriptAction
                    actor={actor.label}
                    align={alignment}
                    badges={
                      <>
                        <Badge tone={interactionRoleTone(actor.role)}>{actor.role}</Badge>
                        <Badge tone="attention">{action.kind}</Badge>
                        <Badge tone={interactionActionStatusTone(action.status)}>{action.status}</Badge>
                        {badges}
                      </>
                    }
                    details={action.details.length === 0
                      ? undefined
                      : (
                        <TranscriptDetailBlock label="Details">
                          <DetailList
                            items={action.details.map((detail) => ({ label: detail.label, value: detail.value }))}
                          />
                        </TranscriptDetailBlock>
                      )}
                    input={action.input === undefined
                      ? undefined
                      : (
                        <TranscriptDetailBlock label={action.input.title ?? "Input"}>
                          <TranscriptPayload
                            code={action.input.payload}
                            label={action.input.title ?? "Input"}
                            meta={action.input.format}
                          />
                        </TranscriptDetailBlock>
                      )}
                    key={itemId}
                    meta={timestampLabel}
                    onSelect={() => {
                      onSelectItem(itemId, turn.id, item)
                    }}
                    output={action.output === undefined
                      ? undefined
                      : (
                        <TranscriptDetailBlock label={action.output.title ?? "Output"}>
                          <TranscriptPayload
                            code={action.output.payload}
                            label={action.output.title ?? "Output"}
                            meta={action.output.format}
                          />
                        </TranscriptDetailBlock>
                      )}
                    selected={selectedItemId === itemId}
                    supportingText={action.supportingText}
                    title={action.label}
                    tone={messageTone(item)}
                  />
                )),
                Match.exhaustive
              )
            })}
          </TranscriptTurn>
        ))}
      </Stack>
    )
