import type { InteractionSurfaceModel } from "../../../../contracts/presentation/interactions.js"

import { Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import {
  interactionEmptyClassName,
  interactionSurfaceShell,
  interactionTurnListClassName
} from "../theme/interaction.js"

import { InteractionTurn } from "./InteractionTurn.js"

export const InteractionSurface = ({
  model,
  onSelectItem,
  selectedItemId
}: {
  readonly model: InteractionSurfaceModel
  readonly onSelectItem?: (id: string) => void
  readonly selectedItemId?: string | null
}) => (
  <Stack as="section" aria-label="Interaction turns" className={interactionSurfaceShell} role="log">
    {model.turns.length === 0
      ? (
        <SemanticText
          as="p"
          className={interactionEmptyClassName}
          role="status"
          text={model.emptyText}
          variant="expanded"
        />
      )
      : (
        <Stack as="ol" className={interactionTurnListClassName}>
          {model.turns.map((turn) => (
            <InteractionTurn
              key={turn.id}
              turn={turn}
              {...(onSelectItem === undefined ? {} : { onSelectItem })}
              {...(selectedItemId === undefined ? {} : { selectedItemId })}
            />
          ))}
        </Stack>
      )}
  </Stack>
)
