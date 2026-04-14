import { Schema } from "effect"

import { PresentationDetailRow } from "../detail-row.js"

import { PayloadModel } from "./payload.js"

export const ActionKind = Schema.Literal("tool", "command", "runtime", "custom")
export const ActionStatus = Schema.Literal("default", "active", "success", "error")

export type ActionKind = typeof ActionKind.Type
export type ActionStatus = typeof ActionStatus.Type

export class ActionModel extends Schema.Class<ActionModel>("ActionModel")({
  callId: Schema.optional(Schema.String),
  details: Schema.Array(PresentationDetailRow),
  id: Schema.String,
  input: Schema.optional(PayloadModel),
  kind: ActionKind,
  label: Schema.String,
  output: Schema.optional(PayloadModel),
  status: ActionStatus,
  supportingText: Schema.optional(Schema.String)
}) {}
