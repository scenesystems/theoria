import { Schema } from "effect"

import { TraceSelection } from "./trace-selection.js"

export const PinnedObjectiveStatus = Schema.Literal("draft", "active", "handoff-ready")

export type PinnedObjectiveStatus = typeof PinnedObjectiveStatus.Type

export class PinnedObjective extends Schema.Class<PinnedObjective>("PinnedObjective")({
  id: Schema.String,
  selection: TraceSelection,
  sourceAnnotationId: Schema.NullOr(Schema.String),
  status: PinnedObjectiveStatus,
  summary: Schema.String,
  title: Schema.String
}) {}
