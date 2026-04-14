import { Schema } from "effect"

import { PinnedObjective } from "./pinned-objective.js"
import { TraceAnnotation } from "./trace-annotation.js"
import { TraceAnnotationKind } from "./trace-annotation.js"
import { TraceSelection } from "./trace-selection.js"

export const InteractionInspectorPanel = Schema.Literal("selection", "annotations", "trace", "materials")

export type InteractionInspectorPanel = typeof InteractionInspectorPanel.Type

export class InteractionAnnotationDraft extends Schema.Class<InteractionAnnotationDraft>("InteractionAnnotationDraft")({
  kind: TraceAnnotationKind,
  label: Schema.String,
  note: Schema.String
}) {}

export class InteractionWorkspaceState extends Schema.Class<InteractionWorkspaceState>("InteractionWorkspaceState")({
  activeTranscriptEntryId: Schema.NullOr(Schema.String),
  activeInspectorPanel: InteractionInspectorPanel,
  annotationDraft: InteractionAnnotationDraft,
  composerDraft: Schema.String,
  pinnedObjectives: Schema.Array(PinnedObjective),
  selectedAnnotationId: Schema.NullOr(Schema.String),
  selectedTrace: Schema.NullOr(TraceSelection),
  traceAnnotations: Schema.Array(TraceAnnotation)
}) {}

export const makeEmptyInteractionAnnotationDraft = (): InteractionAnnotationDraft =>
  InteractionAnnotationDraft.make({
    kind: "finding",
    label: "",
    note: ""
  })

export const makeEmptyInteractionWorkspaceState = (): InteractionWorkspaceState =>
  InteractionWorkspaceState.make({
    activeTranscriptEntryId: null,
    activeInspectorPanel: "selection",
    annotationDraft: makeEmptyInteractionAnnotationDraft(),
    composerDraft: "",
    pinnedObjectives: [],
    selectedAnnotationId: null,
    selectedTrace: null,
    traceAnnotations: []
  })
