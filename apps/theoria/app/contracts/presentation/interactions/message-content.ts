import { Schema } from "effect"

import { PresentationDetailRow } from "../detail-row.js"
import { PayloadModel } from "./payload.js"

export const MessageTextKind = Schema.Literal("body", "thinking", "meta")

export type MessageTextKind = typeof MessageTextKind.Type

export class MessageTextContent extends Schema.TaggedClass<MessageTextContent>()("MessageTextContent", {
  kind: MessageTextKind,
  text: Schema.String
}) {}

export class MessageDetailsContent extends Schema.TaggedClass<MessageDetailsContent>()("MessageDetailsContent", {
  rows: Schema.Array(PresentationDetailRow),
  title: Schema.optional(Schema.String)
}) {}

export class MessagePayloadContent extends Schema.TaggedClass<MessagePayloadContent>()("MessagePayloadContent", {
  payload: PayloadModel
}) {}

export const MessageContent = Schema.Union(
  MessageTextContent,
  MessageDetailsContent,
  MessagePayloadContent
)

export type MessageContent = typeof MessageContent.Type
