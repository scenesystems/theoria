import { Schema } from "effect"

import { PinnedObjective } from "./pinned-objective.js"
import { TraceAnnotation } from "./trace-annotation.js"
import { TraceSelection } from "./trace-selection.js"

export class InteractionComposerContext extends Schema.Class<InteractionComposerContext>("InteractionComposerContext")({
  annotations: Schema.Array(TraceAnnotation),
  pinnedObjectives: Schema.Array(PinnedObjective),
  selection: Schema.NullOr(TraceSelection),
  suggestedPrompt: Schema.NullOr(Schema.String),
  summary: Schema.String
}) {}
