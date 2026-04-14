import { Schema } from "effect"

import { InteractionItem } from "./interaction-item.js"

export class InteractionPanelModel extends Schema.Class<InteractionPanelModel>("InteractionPanelModel")({
  emptyText: Schema.String,
  items: Schema.Array(InteractionItem)
}) {}
