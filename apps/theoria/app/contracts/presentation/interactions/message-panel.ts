import { Schema } from "effect"

import { MessageModel } from "./message.js"

export class MessagePanelModel extends Schema.Class<MessagePanelModel>("MessagePanelModel")({
  emptyText: Schema.String,
  messages: Schema.Array(MessageModel)
}) {}
