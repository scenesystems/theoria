import { Schema } from "effect"

import { ActionModel } from "./action.js"
import { MessageActorModel, MessageAlignment, MessageModel } from "./message.js"

export class InteractionMessageItem extends Schema.TaggedClass<InteractionMessageItem>()("InteractionMessageItem", {
  message: MessageModel
}) {}

export class InteractionActionItem extends Schema.TaggedClass<InteractionActionItem>()("InteractionActionItem", {
  action: ActionModel,
  actor: MessageActorModel,
  alignment: MessageAlignment,
  id: Schema.String,
  timestampLabel: Schema.optional(Schema.String)
}) {}

export const InteractionItem = Schema.Union(InteractionMessageItem, InteractionActionItem)

export type InteractionItem = typeof InteractionItem.Type
