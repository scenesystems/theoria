import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { Match } from "effect"

import type { InteractionItem } from "../../../../contracts/presentation/interactions.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { StatusPill } from "../../../ui/components/feedback/StatusPill.js"
import { InspectorEmptyState } from "../../../ui/components/inspector/InspectorEmptyState.js"
import { InspectorSummaryBlock } from "../../../ui/components/inspector/InspectorSummaryBlock.js"
import { Cluster } from "../../../ui/structure/Cluster.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import {
  interactionActionStatusTone,
  interactionMessageStatusTone,
  interactionRoleTone,
  interactionSelectionSummary
} from "../model.js"

import { InteractionDetailList } from "../primitives/InteractionDetailList.js"
import { InteractionMessageContent } from "../primitives/InteractionMessageContent.js"
import { InteractionPayloadBlock } from "../primitives/InteractionPayloadBlock.js"

export const SelectionDetails = ({ item }: { readonly item: InteractionItem | null }) => {
  if (item === null) {
    return (
      <InspectorEmptyState
        icon={MagnifyingGlassIcon}
        summary="Select a message or tool action in the transcript canvas to inspect its payload, timing, and workflow relevance."
        title="No interaction item selected"
      />
    )
  }

  return Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => (
      <Stack gap="md">
        <InspectorSummaryBlock
          meta={
            <Cluster gap="sm" justify="between">
              <Cluster gap="sm">
                <Badge tone={interactionRoleTone(message.actor.role)}>{message.actor.role}</Badge>
                {message.status === "default"
                  ? null
                  : <StatusPill tone={interactionMessageStatusTone(message.status)}>{message.status}</StatusPill>}
              </Cluster>
              {message.timestampLabel === undefined
                ? null
                : <SemanticText role="pane-meta">{message.timestampLabel}</SemanticText>}
            </Cluster>
          }
          summary={interactionSelectionSummary(item)}
          title={message.actor.label}
        >
          {message.actor.supportingText === undefined
            ? null
            : <SemanticText role="pane-meta">{message.actor.supportingText}</SemanticText>}
        </InspectorSummaryBlock>
        <Stack gap="sm">
          {message.content.map((content, index) => <InteractionMessageContent content={content} key={index} />)}
        </Stack>
      </Stack>
    )),
    Match.tag("InteractionActionItem", (actionItem) => (
      <Stack gap="md">
        <InspectorSummaryBlock
          meta={
            <Cluster gap="sm" justify="between">
              <Cluster gap="sm">
                <Badge tone={interactionRoleTone(actionItem.actor.role)}>{actionItem.actor.role}</Badge>
                <Badge tone="attention">{actionItem.action.kind}</Badge>
                <StatusPill tone={interactionActionStatusTone(actionItem.action.status)}>
                  {actionItem.action.status}
                </StatusPill>
              </Cluster>
              {actionItem.timestampLabel === undefined
                ? null
                : <SemanticText role="pane-meta">{actionItem.timestampLabel}</SemanticText>}
            </Cluster>
          }
          summary={interactionSelectionSummary(item)}
          title={actionItem.action.label}
        >
          <Stack gap="sm">
            <SemanticText role="pane-meta">{actionItem.actor.label}</SemanticText>
            {actionItem.action.callId === undefined
              ? null
              : <SemanticText role="pane-meta">{`call ${actionItem.action.callId}`}</SemanticText>}
            {actionItem.action.supportingText === undefined
              ? null
              : <SemanticText role="pane-meta">{actionItem.action.supportingText}</SemanticText>}
          </Stack>
        </InspectorSummaryBlock>
        <InteractionDetailList
          emptyText="No structured detail rows were preserved for this action."
          items={actionItem.action.details.map((detail) => ({ detail: detail.value, label: detail.label }))}
        />
        {actionItem.action.input === undefined ? null : <InteractionPayloadBlock payload={actionItem.action.input} />}
        {actionItem.action.output === undefined ? null : <InteractionPayloadBlock payload={actionItem.action.output} />}
      </Stack>
    )),
    Match.exhaustive
  )
}
