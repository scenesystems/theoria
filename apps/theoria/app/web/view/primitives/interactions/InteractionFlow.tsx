import { Match } from "effect"

import type { InteractionItem } from "../../../../contracts/presentation/interactions.js"

import { Stack } from "../Layout.js"
import { interactionFlowClassName } from "../theme/interaction.js"

import { InteractionItemView } from "./InteractionItem.js"

const interactionItemKey = (item: InteractionItem): string =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => message.id),
    Match.tag("InteractionActionItem", ({ id }) => id),
    Match.exhaustive
  )

export const InteractionFlow = ({
  items,
  onSelectItem,
  selectedItemId
}: {
  readonly items: ReadonlyArray<InteractionItem>
  readonly onSelectItem?: (id: string) => void
  readonly selectedItemId?: string | null
}) => (
  <Stack as="ol" className={interactionFlowClassName}>
    {items.map((item) => (
      <InteractionItemView
        item={item}
        key={interactionItemKey(item)}
        {...(onSelectItem === undefined ? {} : { onSelectItem })}
        {...(selectedItemId === undefined ? {} : { selectedItemId })}
      />
    ))}
  </Stack>
)
