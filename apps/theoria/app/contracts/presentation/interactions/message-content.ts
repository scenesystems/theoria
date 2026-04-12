import { Schema } from "effect"

import { PresentationDetailRow } from "../detail-row.js"

export const MessageTextKind = Schema.Literal("body", "thinking", "meta")
export const MessageDataDisplay = Schema.Literal("rows", "json")

export type MessageTextKind = typeof MessageTextKind.Type
export type MessageDataDisplay = typeof MessageDataDisplay.Type

export class MessageTextContent extends Schema.TaggedClass<MessageTextContent>()("MessageTextContent", {
  kind: MessageTextKind,
  text: Schema.String
}) {}

export class MessageDataContent extends Schema.TaggedClass<MessageDataContent>()("MessageDataContent", {
  display: MessageDataDisplay,
  rows: Schema.Array(PresentationDetailRow),
  title: Schema.optional(Schema.String)
}) {}

export const MessageContent = Schema.Union(MessageTextContent, MessageDataContent)

export type MessageContent = typeof MessageContent.Type
