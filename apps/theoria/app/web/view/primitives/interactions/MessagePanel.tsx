import type { MessagePanelModel } from "../../../../contracts/presentation/interactions.js"

import { Layer, Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import { messagePanelShell } from "../theme/message.js"

import { Message } from "./Message.js"

export const MessagePanel = ({ model }: { readonly model: MessagePanelModel }) => (
  <Layer className={messagePanelShell}>
    {model.messages.length === 0
      ? <SemanticText as="p" className="text-ink-600" role="status" text={model.emptyText} variant="expanded" />
      : (
        <Stack className="gap-4">
          {model.messages.map((message) => <Message key={message.id} message={message} />)}
        </Stack>
      )}
  </Layer>
)
