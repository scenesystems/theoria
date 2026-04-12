import type { MessageModel } from "../../../../contracts/presentation/interactions.js"

import { Cluster, Layer, Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import { messageBubbleClassName, messageRowClassName } from "../theme/message.js"

import { MessageAvatar } from "./MessageAvatar.js"
import { MessageBlock } from "./MessageBlock.js"

const MessageMeta = ({ message }: { readonly message: MessageModel }) => (
  <Cluster className="gap-2">
    <SemanticText as="span" className="text-ink-600" role="row-label" text={message.actor.label} variant="compact" />
    {message.actor.supportingText === undefined
      ? null
      : (
        <SemanticText
          as="span"
          className="text-ink-500"
          role="code-meta"
          text={message.actor.supportingText}
          variant="compact"
        />
      )}
    {message.timestampLabel === undefined
      ? null
      : (
        <SemanticText
          as="span"
          className="text-ink-500"
          role="code-meta"
          text={message.timestampLabel}
          variant="compact"
        />
      )}
  </Cluster>
)

export const Message = ({ message }: { readonly message: MessageModel }) => {
  const bubble = (
    <Layer className={messageBubbleClassName({ role: message.actor.role, status: message.status })}>
      <Stack className="gap-3">
        <MessageMeta message={message} />
        <Stack className="gap-3">
          {message.blocks.map((block, index) => <MessageBlock block={block} key={index} />)}
        </Stack>
      </Stack>
    </Layer>
  )

  return message.alignment === "end"
    ? (
      <Cluster className={`items-end gap-3 ${messageRowClassName(message.alignment)}`}>
        {bubble}
        <MessageAvatar actor={message.actor} />
      </Cluster>
    )
    : (
      <Cluster className={`items-end gap-3 ${messageRowClassName(message.alignment)}`}>
        <MessageAvatar actor={message.actor} />
        {bubble}
      </Cluster>
    )
}
