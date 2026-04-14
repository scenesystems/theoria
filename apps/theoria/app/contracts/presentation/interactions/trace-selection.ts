import { Schema } from "effect"

export const TraceSelectionKind = Schema.Literal("turn", "message", "action", "span")

export type TraceSelectionKind = typeof TraceSelectionKind.Type

export class TraceSelectionAnchor extends Schema.Class<TraceSelectionAnchor>("TraceSelectionAnchor")({
  itemId: Schema.String,
  transcriptEntryId: Schema.String,
  turnId: Schema.String
}) {}

export class TraceSelection extends Schema.Class<TraceSelection>("TraceSelection")({
  anchor: TraceSelectionAnchor,
  contextLabel: Schema.NullOr(Schema.String),
  itemKind: TraceSelectionKind,
  quote: Schema.NullOr(Schema.String),
  summary: Schema.String
}) {}
