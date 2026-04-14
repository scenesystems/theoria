import { Schema } from "effect"
import * as Arr from "effect/Array"

export class PresentationDetailRow extends Schema.Class<PresentationDetailRow>("PresentationDetailRow")({
  label: Schema.String,
  value: Schema.String
}) {}

export const presentationDetailRow = (label: string, value: string): PresentationDetailRow =>
  PresentationDetailRow.make({ label, value })

export const presentationDetailRowsTableRows = (
  rows: ReadonlyArray<PresentationDetailRow>
): ReadonlyArray<ReadonlyArray<string>> => Arr.map(rows, ({ label, value }) => [label, value])
