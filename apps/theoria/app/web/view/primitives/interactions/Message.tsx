import { Button } from "@base-ui/react/button"

import type { MessageModel } from "../../../../contracts/presentation/interactions.js"

import { Layer, Stack } from "../Layout.js"
import { messageFrameClassName } from "../theme/message.js"

import { InteractionRow } from "./InteractionRow.js"
import { MessageContentView } from "./MessageContent.js"

const interactiveFrameClassName = ({
  interactive,
  message,
  selected
}: {
  readonly interactive: boolean
  readonly message: MessageModel
  readonly selected: boolean
}): string =>
  [
    messageFrameClassName({ role: message.actor.role, status: message.status }),
    interactive
      ? "cursor-pointer text-left transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px"
      : "",
    interactive && !selected ? "hover:border-ink-400/70 hover:shadow-float" : "",
    selected ? "border-ink-900/90 ring-2 ring-ink-900/14 shadow-float" : "",
    interactive
      ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-2"
      : ""
  ].filter((value) => value.length > 0).join(" ")

export const Message = ({
  message,
  onSelect,
  selected = false
}: {
  readonly message: MessageModel
  readonly onSelect?: () => void
  readonly selected?: boolean
}) => {
  const interactive = onSelect !== undefined
  const content = (
    <Stack className="gap-3.5">
      {message.content.map((contentItem, index) => <MessageContentView content={contentItem} key={index} />)}
    </Stack>
  )

  return (
    <InteractionRow
      actor={message.actor}
      alignment={message.alignment}
      {...(message.timestampLabel === undefined ? {} : { timestampLabel: message.timestampLabel })}
    >
      {interactive
        ? (
          <Button
            aria-label={`Inspect message from ${message.actor.label}`}
            aria-pressed={selected}
            className={interactiveFrameClassName({ interactive, message, selected })}
            onClick={() => {
              onSelect()
            }}
            type="button"
          >
            {content}
          </Button>
        )
        : <Layer className={interactiveFrameClassName({ interactive, message, selected })}>{content}</Layer>}
    </InteractionRow>
  )
}
