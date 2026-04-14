import type { MessageActorModel } from "../../../../contracts/presentation/interactions.js"

import { Layer } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import { messageAvatarClassName } from "../theme/message.js"

export const MessageAvatar = ({ actor }: { readonly actor: MessageActorModel }) => (
  <Layer as="span" aria-hidden="true" className={messageAvatarClassName(actor.role)}>
    <SemanticText as="span" role="row-label" text={actor.avatar.fallback} variant="compact" />
  </Layer>
)
