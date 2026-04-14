import type { MessageModel } from "../../../../contracts/presentation/interactions.js"
import { ButtonBehavior } from "../../../ui/behavior/ButtonBehavior.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { StatusPill } from "../../../ui/components/feedback/StatusPill.js"
import { Box, mergeClassNames } from "../../../ui/structure/Box.js"
import { Cluster } from "../../../ui/structure/Cluster.js"
import { Inline } from "../../../ui/structure/Inline.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { interactionMessageStatusTone, interactionRoleTone } from "../model.js"

import { InteractionAvatar } from "./InteractionAvatar.js"
import { InteractionMessageContent } from "./InteractionMessageContent.js"

const messageSurfaceClassName = ({
  interactive,
  role,
  selected
}: {
  readonly interactive: boolean
  readonly role: MessageModel["actor"]["role"]
  readonly selected: boolean
}): string =>
  mergeClassNames(
    "w-full max-w-[48rem] rounded-ui-xl border p-4 text-left shadow-ui-chip transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
    role === "assistant"
      ? "border-border-muted bg-surface-panel/96"
      : role === "user"
      ? "border-accent-border bg-accent-surface/70"
      : role === "tool"
      ? "border-intent-attention-border bg-intent-attention-surface/70"
      : role === "runtime"
      ? "border-intent-danger-border bg-intent-danger-surface/55"
      : "border-border-strong bg-surface-canvas/94",
    interactive ? "cursor-pointer hover:-translate-y-px hover:shadow-float" : undefined,
    interactive ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30" : undefined,
    selected ? "border-content-primary ring-2 ring-focus-ring/20 shadow-float" : undefined
  )

const messageBubble = ({
  interactive,
  message,
  onSelect,
  selected
}: {
  readonly interactive: boolean
  readonly message: MessageModel
  readonly onSelect?: () => void
  readonly selected: boolean
}) => {
  const content = (
    <Stack gap="sm">
      <Stack gap="xs">
        <Cluster gap="sm" justify="between">
          <Inline as="span" gap="sm">
            <Badge tone={interactionRoleTone(message.actor.role)}>{message.actor.role}</Badge>
            {message.status === "default"
              ? null
              : <StatusPill tone={interactionMessageStatusTone(message.status)}>{message.status}</StatusPill>}
          </Inline>
          {message.timestampLabel === undefined
            ? null
            : (
              <SemanticText role="label" tone="muted">
                {message.timestampLabel}
              </SemanticText>
            )}
        </Cluster>
        <SemanticText role="body">{message.actor.label}</SemanticText>
        {message.actor.supportingText === undefined
          ? null
          : (
            <SemanticText role="body-sm" tone="muted">
              {message.actor.supportingText}
            </SemanticText>
          )}
      </Stack>
      <Stack gap="sm">
        {message.content.map((content, index) => <InteractionMessageContent content={content} key={index} />)}
      </Stack>
    </Stack>
  )

  return interactive
    ? (
      <ButtonBehavior
        aria-label={`Inspect message from ${message.actor.label}`}
        aria-pressed={selected}
        className={messageSurfaceClassName({ interactive, role: message.actor.role, selected })}
        onClick={() => {
          onSelect?.()
        }}
        type="button"
      >
        {content}
      </ButtonBehavior>
    )
    : <Box className={messageSurfaceClassName({ interactive, role: message.actor.role, selected })}>{content}</Box>
}

export const InteractionMessageCard = ({
  message,
  onSelect,
  selected = false
}: {
  readonly message: MessageModel
  readonly onSelect?: () => void
  readonly selected?: boolean
}) => {
  const interactive = onSelect !== undefined
  const isEndAligned = message.alignment === "end"

  return (
    <Box as="li" className={mergeClassNames("flex w-full", isEndAligned ? "justify-end" : "justify-start")}>
      <Inline align="start" gap="md" {...(isEndAligned ? { className: "flex-row-reverse" } : {})}>
        <InteractionAvatar actor={message.actor} />
        {messageBubble({ interactive, message, selected, ...(onSelect === undefined ? {} : { onSelect }) })}
      </Inline>
    </Box>
  )
}
