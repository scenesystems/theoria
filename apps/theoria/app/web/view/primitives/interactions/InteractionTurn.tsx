import type { InteractionTurnModel } from "../../../../contracts/presentation/interactions.js"

import { Layer, Stack } from "../Layout.js"
import {
  interactionTurnBodyClassName,
  interactionTurnClassName,
  interactionTurnRailClassName
} from "../theme/interaction.js"

import { InteractionFlow } from "./InteractionFlow.js"

export const InteractionTurn = ({
  onSelectItem,
  selectedItemId,
  turn
}: {
  readonly onSelectItem?: (id: string) => void
  readonly selectedItemId?: string | null
  readonly turn: InteractionTurnModel
}) => (
  <Layer as="li" className={interactionTurnClassName}>
    <Layer aria-hidden="true" className={interactionTurnRailClassName} />
    <Stack className={interactionTurnBodyClassName}>
      <InteractionFlow
        items={turn.items}
        {...(onSelectItem === undefined ? {} : { onSelectItem })}
        {...(selectedItemId === undefined ? {} : { selectedItemId })}
      />
    </Stack>
  </Layer>
)
