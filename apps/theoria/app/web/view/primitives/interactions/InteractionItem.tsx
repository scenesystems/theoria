import { Match } from "effect"

import type { InteractionItem } from "../../../../contracts/presentation/interactions.js"

import { InteractionAction } from "./InteractionAction.js"
import { Message } from "./Message.js"

export const InteractionItemView = ({
  item,
  onSelectItem,
  selectedItemId
}: {
  readonly item: InteractionItem
  readonly onSelectItem?: (id: string) => void
  readonly selectedItemId?: string | null
}) =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => (
      <Message
        message={message}
        selected={selectedItemId === message.id}
        {...(onSelectItem === undefined ? {} : { onSelect: () => onSelectItem(message.id) })}
      />
    )),
    Match.tag("InteractionActionItem", (actionItem) => (
      <InteractionAction
        item={actionItem}
        selected={selectedItemId === actionItem.id}
        {...(onSelectItem === undefined ? {} : { onSelect: () => onSelectItem(actionItem.id) })}
      />
    )),
    Match.exhaustive
  )
