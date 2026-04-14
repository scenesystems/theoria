import { Schema } from "effect"

import { TraceSelection } from "./trace-selection.js"

export const TraceAnnotationKind = Schema.Literal("note", "finding", "objective", "question", "risk")
export const TraceAnnotationTone = Schema.Literal("neutral", "info", "attention", "danger")

export type TraceAnnotationKind = typeof TraceAnnotationKind.Type
export type TraceAnnotationTone = typeof TraceAnnotationTone.Type

export class TraceAnnotation extends Schema.Class<TraceAnnotation>("TraceAnnotation")({
  id: Schema.String,
  kind: TraceAnnotationKind,
  label: Schema.String,
  note: Schema.NullOr(Schema.String),
  selection: TraceSelection,
  tone: TraceAnnotationTone
}) {}
