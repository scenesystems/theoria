import type { InteractionActionItem } from "../../../../contracts/presentation/interactions.js"
import { ButtonBehavior } from "../../../ui/behavior/ButtonBehavior.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { StatusPill } from "../../../ui/components/feedback/StatusPill.js"
import { Box, mergeClassNames } from "../../../ui/structure/Box.js"
import { Cluster } from "../../../ui/structure/Cluster.js"
import { Inline } from "../../../ui/structure/Inline.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { interactionActionStatusTone, interactionRoleTone } from "../model.js"

import { InteractionAvatar } from "./InteractionAvatar.js"
import { InteractionDetailList } from "./InteractionDetailList.js"
import { InteractionPayloadBlock } from "./InteractionPayloadBlock.js"

const actionSurfaceClassName = (
  { interactive, selected }: { readonly interactive: boolean; readonly selected: boolean }
) =>
  mergeClassNames(
    "w-full max-w-[48rem] rounded-ui-xl border border-border-muted bg-surface-sunken/90 p-4 text-left shadow-ui-chip transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
    interactive ? "cursor-pointer hover:-translate-y-px hover:border-content-subtle hover:shadow-float" : undefined,
    interactive ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30" : undefined,
    selected ? "border-content-primary ring-2 ring-focus-ring/20 shadow-float" : undefined
  )

const actionBubble = ({
  item,
  onSelect,
  selected
}: {
  readonly item: InteractionActionItem
  readonly onSelect?: () => void
  readonly selected: boolean
}) => {
  const interactive = onSelect !== undefined
  const content = (
    <Stack gap="sm">
      <Stack gap="xs">
        <Cluster gap="sm" justify="between">
          <Inline as="span" gap="sm">
            <Badge tone={interactionRoleTone(item.actor.role)}>{item.actor.role}</Badge>
            <Badge tone="attention">{item.action.kind}</Badge>
            <StatusPill tone={interactionActionStatusTone(item.action.status)}>{item.action.status}</StatusPill>
          </Inline>
          {item.timestampLabel === undefined
            ? null
            : (
              <SemanticText role="label" tone="muted">
                {item.timestampLabel}
              </SemanticText>
            )}
        </Cluster>
        <SemanticText role="body">{item.action.label}</SemanticText>
        <Inline as="span" gap="sm" wrap>
          <SemanticText role="body-sm" tone="muted">
            {item.actor.label}
          </SemanticText>
          {item.action.callId === undefined
            ? null
            : (
              <SemanticText role="body-sm" tone="muted">
                {`call ${item.action.callId}`}
              </SemanticText>
            )}
          {item.action.supportingText === undefined
            ? null
            : (
              <SemanticText role="body-sm" tone="muted">
                {item.action.supportingText}
              </SemanticText>
            )}
        </Inline>
      </Stack>
      {item.action.details.length === 0
        ? null
        : (
          <InteractionDetailList
            emptyText="No structured detail rows were preserved for this action."
            items={item.action.details.map((detail) => ({ detail: detail.value, label: detail.label }))}
          />
        )}
      {item.action.input === undefined ? null : <InteractionPayloadBlock payload={item.action.input} />}
      {item.action.output === undefined ? null : <InteractionPayloadBlock payload={item.action.output} />}
    </Stack>
  )

  return interactive
    ? (
      <ButtonBehavior
        aria-label={`Inspect ${item.action.kind} ${item.action.label}`}
        aria-pressed={selected}
        className={actionSurfaceClassName({ interactive, selected })}
        onClick={() => {
          onSelect?.()
        }}
        type="button"
      >
        {content}
      </ButtonBehavior>
    )
    : <Box className={actionSurfaceClassName({ interactive, selected })}>{content}</Box>
}

export const InteractionActionCard = ({
  item,
  onSelect,
  selected = false
}: {
  readonly item: InteractionActionItem
  readonly onSelect?: () => void
  readonly selected?: boolean
}) => {
  const isEndAligned = item.alignment === "end"

  return (
    <Box as="li" className={mergeClassNames("flex w-full", isEndAligned ? "justify-end" : "justify-start")}>
      <Inline align="start" gap="md" {...(isEndAligned ? { className: "flex-row-reverse" } : {})}>
        <InteractionAvatar actor={item.actor} />
        {actionBubble({ item, selected, ...(onSelect === undefined ? {} : { onSelect }) })}
      </Inline>
    </Box>
  )
}
