import {
  InteractionMessageItem,
  InteractionPanelModel,
  type MessagePanelModel
} from "../../../../contracts/presentation/interactions.js"

import { InteractionPanel } from "./InteractionPanel.js"

export const MessagePanel = ({ model }: { readonly model: MessagePanelModel }) => (
  <InteractionPanel
    model={InteractionPanelModel.make({
      emptyText: model.emptyText,
      items: model.messages.map((message) => InteractionMessageItem.make({ message }))
    })}
  />
)
