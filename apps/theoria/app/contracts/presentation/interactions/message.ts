import { Schema } from "effect"

import { MessageAvatarModel } from "./avatar.js"
import { MessageContent } from "./message-content.js"

export const MessageRole = Schema.Literal("user", "assistant", "system", "tool", "runtime", "custom")
export const MessageAlignment = Schema.Literal("start", "end")
export const MessageStatus = Schema.Literal("default", "active", "error")

export type MessageRole = typeof MessageRole.Type
export type MessageAlignment = typeof MessageAlignment.Type
export type MessageStatus = typeof MessageStatus.Type

export class MessageActorModel extends Schema.Class<MessageActorModel>("MessageActorModel")({
  avatar: MessageAvatarModel,
  label: Schema.String,
  role: MessageRole,
  supportingText: Schema.optional(Schema.String)
}) {}

export class MessageModel extends Schema.Class<MessageModel>("MessageModel")({
  actor: MessageActorModel,
  alignment: MessageAlignment,
  blocks: Schema.Array(MessageContent),
  id: Schema.String,
  status: MessageStatus,
  timestampLabel: Schema.optional(Schema.String)
}) {}
