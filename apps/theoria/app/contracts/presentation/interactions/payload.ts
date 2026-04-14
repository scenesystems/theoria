import { Schema } from "effect"

export const PayloadFormat = Schema.Literal("plain", "json")

export type PayloadFormat = typeof PayloadFormat.Type

export class PayloadModel extends Schema.Class<PayloadModel>("PayloadModel")({
  format: PayloadFormat,
  payload: Schema.String,
  title: Schema.optional(Schema.String)
}) {}
