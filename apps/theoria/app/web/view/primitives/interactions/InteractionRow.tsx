import type { ReactNode } from "react"

import type { MessageActorModel, MessageAlignment } from "../../../../contracts/presentation/interactions.js"

import { Layer, Stack } from "../Layout.js"
import { messageBodyClassName, messageRowClassName } from "../theme/message.js"

import { MessageAvatar } from "./MessageAvatar.js"
import { MessageHeader } from "./MessageHeader.js"

export const InteractionRow = ({
  actor,
  alignment,
  children,
  supportingText,
  timestampLabel
}: {
  readonly actor: MessageActorModel
  readonly alignment: MessageAlignment
  readonly children: ReactNode
  readonly supportingText?: string
  readonly timestampLabel?: string
}) => {
  const body = (
    <Stack className={messageBodyClassName(alignment)}>
      <MessageHeader
        actor={actor}
        alignment={alignment}
        {...(supportingText === undefined ? {} : { supportingText })}
        {...(timestampLabel === undefined ? {} : { timestampLabel })}
      />
      {children}
    </Stack>
  )

  return alignment === "end"
    ? (
      <Layer as="li" className={messageRowClassName(alignment)}>
        {body}
        <MessageAvatar actor={actor} />
      </Layer>
    )
    : (
      <Layer as="li" className={messageRowClassName(alignment)}>
        <MessageAvatar actor={actor} />
        {body}
      </Layer>
    )
}
