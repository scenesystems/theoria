import { Schema } from "effect"

export class PresentationDetailRow extends Schema.Class<PresentationDetailRow>("PresentationDetailRow")({
  label: Schema.String,
  value: Schema.String
}) {}

export const presentationDetailRow = (label: string, value: string): PresentationDetailRow =>
  PresentationDetailRow.make({ label, value })
