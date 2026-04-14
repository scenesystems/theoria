import { Schema } from "effect"

import { TraceSelection } from "./trace-selection.js"

export const WorkflowHandoffStatus = Schema.Literal("draft", "ready")

export type WorkflowHandoffStatus = typeof WorkflowHandoffStatus.Type

export class WorkflowHandoffDraft extends Schema.Class<WorkflowHandoffDraft>("WorkflowHandoffDraft")({
  annotationIds: Schema.Array(Schema.String),
  objectiveIds: Schema.Array(Schema.String),
  selection: Schema.NullOr(TraceSelection),
  status: WorkflowHandoffStatus,
  summary: Schema.String,
  transcriptEntryId: Schema.String,
  title: Schema.String
}) {}
