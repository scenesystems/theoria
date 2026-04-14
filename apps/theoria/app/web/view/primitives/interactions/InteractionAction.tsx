import type { InteractionActionItem } from "../../../../contracts/presentation/interactions.js"

import { Layer } from "../Layout.js"

import { Action } from "./Action.js"
import { InteractionRow } from "./InteractionRow.js"

export const InteractionAction = ({
  item,
  onSelect,
  selected = false
}: {
  readonly item: InteractionActionItem
  readonly onSelect?: () => void
  readonly selected?: boolean
}) => (
  <InteractionRow
    actor={item.actor}
    alignment={item.alignment}
    {...(item.timestampLabel === undefined ? {} : { timestampLabel: item.timestampLabel })}
  >
    <Layer className="w-full">
      <Action action={item.action} selected={selected} {...(onSelect === undefined ? {} : { onSelect })} />
    </Layer>
  </InteractionRow>
)
