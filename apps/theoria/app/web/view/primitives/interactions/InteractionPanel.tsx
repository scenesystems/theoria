import type { InteractionPanelModel } from "../../../../contracts/presentation/interactions.js"

import { Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import { interactionEmptyClassName, interactionPanelShell } from "../theme/interaction.js"

import { InteractionFlow } from "./InteractionFlow.js"

export const InteractionPanel = ({ model }: { readonly model: InteractionPanelModel }) => (
  <Stack as="section" aria-label="Interactions" className={interactionPanelShell} role="log">
    {model.items.length === 0
      ? (
        <SemanticText
          as="p"
          className={interactionEmptyClassName}
          role="status"
          text={model.emptyText}
          variant="expanded"
        />
      )
      : <InteractionFlow items={model.items} />}
  </Stack>
)
