import { Schema } from "effect"

export class MessageAvatarModel extends Schema.Class<MessageAvatarModel>("MessageAvatarModel")({
  fallback: Schema.String,
  label: Schema.String
}) {}
