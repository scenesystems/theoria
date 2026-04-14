import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import {
  InteractionAnnotationDraft,
  InteractionComposerContext,
  type InteractionInspectorPanel,
  InteractionWorkspaceState,
  makeEmptyInteractionAnnotationDraft,
  makeEmptyInteractionWorkspaceState,
  PinnedObjective,
  TraceAnnotation,
  type TraceAnnotationKind,
  type TraceSelection,
  WorkflowHandoffDraft
} from "../../../contracts/presentation/interactions.js"

const matchesSelection = ({
  selection,
  target
}: {
  readonly selection: TraceSelection
  readonly target: TraceSelection
}): boolean =>
  selection.anchor.itemId === target.anchor.itemId &&
  selection.anchor.transcriptEntryId === target.anchor.transcriptEntryId &&
  selection.anchor.turnId === target.anchor.turnId

const updateInteractionWorkspaceState = (
  ctx: AtomType.FnContext,
  update: (state: InteractionWorkspaceState) => InteractionWorkspaceState
): void => {
  ctx.set(interactionWorkspaceStateAtom, update(ctx(interactionWorkspaceStateAtom)))
}

const pluralSuffix = (count: number): string => count === 1 ? "" : "s"

const annotationToneByKind: Record<TraceAnnotationKind, TraceAnnotation["tone"]> = {
  note: "neutral",
  finding: "attention",
  objective: "info",
  question: "info",
  risk: "danger"
}

const createTraceAnnotationId = ({
  kind,
  selection
}: {
  readonly kind: TraceAnnotationKind
  readonly selection: TraceSelection
}): string => `annotation:${selection.anchor.transcriptEntryId}:${selection.anchor.itemId}:${kind}`

const createPinnedObjectiveId = (selection: TraceSelection): string =>
  `objective:${selection.anchor.transcriptEntryId}:${selection.anchor.itemId}`

const handoffTranscriptEntryId = (state: InteractionWorkspaceState): string | null =>
  state.selectedTrace?.anchor.transcriptEntryId ??
    state.pinnedObjectives[0]?.selection.anchor.transcriptEntryId ??
    state.traceAnnotations[0]?.selection.anchor.transcriptEntryId ??
    null

const resetAnnotationDraft = (state: InteractionWorkspaceState): InteractionWorkspaceState =>
  InteractionWorkspaceState.make({
    ...state,
    annotationDraft: makeEmptyInteractionAnnotationDraft()
  })

const setInteractionAnnotationDraft = ({
  draft,
  state
}: {
  readonly draft: InteractionAnnotationDraft
  readonly state: InteractionWorkspaceState
}): InteractionWorkspaceState =>
  InteractionWorkspaceState.make({
    ...state,
    annotationDraft: draft
  })

const composerSummary = (state: InteractionWorkspaceState): string => {
  if (state.selectedTrace !== null) {
    return `Ground the next study move in ${state.selectedTrace.summary.toLowerCase()}.`
  }

  if (state.pinnedObjectives.length > 0) {
    return `Continue shaping ${state.pinnedObjectives.length} pinned objective${
      pluralSuffix(state.pinnedObjectives.length)
    } into a workflow candidate.`
  }

  if (state.traceAnnotations.length > 0) {
    return `Use the current annotations to form explicit study intent before handing off to workflow.`
  }

  return "Select a trace event, annotate it, and pin the objective you want the agent to pursue."
}

const composerPrompt = (state: InteractionWorkspaceState): string | null => {
  const [firstPinnedObjective] = state.pinnedObjectives

  if (state.selectedTrace !== null) {
    return `Turn this trace selection into a workflow hypothesis: ${state.selectedTrace.summary}`
  }

  if (firstPinnedObjective) {
    return `Propose a workflow candidate for the objective: ${firstPinnedObjective.title}`
  }

  return null
}

export const interactionWorkspaceStateAtom: AtomType.Writable<InteractionWorkspaceState> = Atom.make(
  makeEmptyInteractionWorkspaceState()
).pipe(Atom.keepAlive)

export const setInteractionActiveTranscriptAtom = Atom.fnSync<string | null>()((entryId, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    InteractionWorkspaceState.make({
      ...state,
      activeTranscriptEntryId: entryId,
      activeInspectorPanel: "selection",
      selectedAnnotationId: null,
      selectedTrace: null
    }))
})

export const setInteractionInspectorPanelAtom = Atom.fnSync<InteractionInspectorPanel>()((panel, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    InteractionWorkspaceState.make({
      ...state,
      activeInspectorPanel: panel
    }))
})

export const selectInteractionTraceAtom = Atom.fnSync<TraceSelection | null>()((selection, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    InteractionWorkspaceState.make({
      ...state,
      activeTranscriptEntryId: selection?.anchor.transcriptEntryId ?? state.activeTranscriptEntryId,
      activeInspectorPanel: "selection",
      selectedAnnotationId: null,
      selectedTrace: selection
    }))
})

export const clearInteractionWorkspaceAtom = Atom.fnSync<void>()((_, ctx) => {
  ctx.set(interactionWorkspaceStateAtom, makeEmptyInteractionWorkspaceState())
})

export const setInteractionComposerDraftAtom = Atom.fnSync<string>()((draft, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    InteractionWorkspaceState.make({
      ...state,
      composerDraft: draft
    }))
})

export const setInteractionAnnotationDraftKindAtom = Atom.fnSync<TraceAnnotationKind>()((kind, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    setInteractionAnnotationDraft({
      draft: InteractionAnnotationDraft.make({
        ...state.annotationDraft,
        kind
      }),
      state
    }))
})

export const setInteractionAnnotationDraftLabelAtom = Atom.fnSync<string>()((label, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    setInteractionAnnotationDraft({
      draft: InteractionAnnotationDraft.make({
        ...state.annotationDraft,
        label
      }),
      state
    }))
})

export const setInteractionAnnotationDraftNoteAtom = Atom.fnSync<string>()((note, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    setInteractionAnnotationDraft({
      draft: InteractionAnnotationDraft.make({
        ...state.annotationDraft,
        note
      }),
      state
    }))
})

export const addTraceAnnotationAtom = Atom.fnSync<TraceAnnotation>()((annotation, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    InteractionWorkspaceState.make({
      ...state,
      activeInspectorPanel: "annotations",
      selectedAnnotationId: annotation.id,
      traceAnnotations: [...state.traceAnnotations.filter((item) => item.id !== annotation.id), annotation]
    }))
})

export const createInteractionAnnotationAtom = Atom.fnSync<void>()((_, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) => {
    const selection = state.selectedTrace

    if (selection === null) {
      return state
    }

    const trimmedLabel = state.annotationDraft.label.trim()
    const trimmedNote = state.annotationDraft.note.trim()
    const annotation = TraceAnnotation.make({
      id: createTraceAnnotationId({ kind: state.annotationDraft.kind, selection }),
      kind: state.annotationDraft.kind,
      label: trimmedLabel.length === 0 ? selection.summary : trimmedLabel,
      note: trimmedNote.length === 0 ? null : trimmedNote,
      selection,
      tone: annotationToneByKind[state.annotationDraft.kind]
    })

    return resetAnnotationDraft(
      InteractionWorkspaceState.make({
        ...state,
        activeInspectorPanel: "annotations",
        selectedAnnotationId: annotation.id,
        traceAnnotations: [...state.traceAnnotations.filter((item) => item.id !== annotation.id), annotation]
      })
    )
  })
})

export const selectInteractionAnnotationAtom = Atom.fnSync<string>()((annotationId, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) => {
    const selectedAnnotation = state.traceAnnotations.find((annotation) => annotation.id === annotationId)

    return !selectedAnnotation
      ? state
      : InteractionWorkspaceState.make({
        ...state,
        activeTranscriptEntryId: selectedAnnotation.selection.anchor.transcriptEntryId,
        activeInspectorPanel: "annotations",
        selectedAnnotationId: annotationId,
        selectedTrace: selectedAnnotation.selection
      })
  })
})

export const removeTraceAnnotationAtom = Atom.fnSync<string>()((annotationId, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) => {
    const remainingAnnotations = state.traceAnnotations.filter((item) => item.id !== annotationId)
    const remainingObjectives = state.pinnedObjectives.filter((item) => item.sourceAnnotationId !== annotationId)

    return InteractionWorkspaceState.make({
      ...state,
      pinnedObjectives: remainingObjectives,
      selectedAnnotationId: state.selectedAnnotationId === annotationId ? null : state.selectedAnnotationId,
      traceAnnotations: remainingAnnotations
    })
  })
})

export const pinInteractionObjectiveAtom = Atom.fnSync<PinnedObjective>()((objective, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    InteractionWorkspaceState.make({
      ...state,
      activeInspectorPanel: "annotations",
      pinnedObjectives: [...state.pinnedObjectives.filter((item) => item.id !== objective.id), objective]
    }))
})

export const pinSelectedInteractionObjectiveAtom = Atom.fnSync<void>()((_, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) => {
    const selection = state.selectedTrace

    if (selection === null) {
      return state
    }

    const trimmedLabel = state.annotationDraft.label.trim()
    const trimmedNote = state.annotationDraft.note.trim()
    const objective = PinnedObjective.make({
      id: createPinnedObjectiveId(selection),
      selection,
      sourceAnnotationId: state.selectedAnnotationId,
      status: "active",
      summary: trimmedNote.length === 0 ? selection.summary : trimmedNote,
      title: trimmedLabel.length === 0 ? selection.summary : trimmedLabel
    })

    return InteractionWorkspaceState.make({
      ...state,
      activeInspectorPanel: "annotations",
      pinnedObjectives: [...state.pinnedObjectives.filter((item) => item.id !== objective.id), objective]
    })
  })
})

export const pinInteractionAnnotationObjectiveAtom = Atom.fnSync<string>()((annotationId, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) => {
    const sourceAnnotation = state.traceAnnotations.find((annotation) => annotation.id === annotationId)

    if (!sourceAnnotation) {
      return state
    }

    const objective = PinnedObjective.make({
      id: createPinnedObjectiveId(sourceAnnotation.selection),
      selection: sourceAnnotation.selection,
      sourceAnnotationId: sourceAnnotation.id,
      status: "handoff-ready",
      summary: sourceAnnotation.note ?? sourceAnnotation.selection.summary,
      title: sourceAnnotation.label
    })

    return InteractionWorkspaceState.make({
      ...state,
      activeInspectorPanel: "annotations",
      pinnedObjectives: [...state.pinnedObjectives.filter((item) => item.id !== objective.id), objective]
    })
  })
})

export const unpinInteractionObjectiveAtom = Atom.fnSync<string>()((objectiveId, ctx) => {
  updateInteractionWorkspaceState(ctx, (state) =>
    InteractionWorkspaceState.make({
      ...state,
      pinnedObjectives: state.pinnedObjectives.filter((item) => item.id !== objectiveId)
    }))
})

export const interactionComposerContextAtom: AtomType.Atom<InteractionComposerContext> = Atom.make((
  get: AtomType.Context
) => {
  const state = get(interactionWorkspaceStateAtom)
  const selectedTrace = state.selectedTrace
  const selectedAnnotations = selectedTrace === null
    ? state.traceAnnotations
    : state.traceAnnotations.filter((annotation) =>
      matchesSelection({ selection: annotation.selection, target: selectedTrace })
    )
  const selectedObjectives = selectedTrace === null
    ? state.pinnedObjectives
    : state.pinnedObjectives.filter((objective) =>
      matchesSelection({ selection: objective.selection, target: selectedTrace })
    )

  return InteractionComposerContext.make({
    annotations: selectedAnnotations,
    pinnedObjectives: selectedObjectives,
    selection: selectedTrace,
    suggestedPrompt: composerPrompt(state),
    summary: composerSummary(state)
  })
})

export const interactionWorkflowHandoffDraftAtom: AtomType.Atom<WorkflowHandoffDraft | null> = Atom.make((
  get: AtomType.Context
) => {
  const state = get(interactionWorkspaceStateAtom)
  const transcriptEntryId = handoffTranscriptEntryId(state)

  if (transcriptEntryId === null) {
    return null
  }

  const traceAnnotations = state.traceAnnotations.filter(
    (annotation) => annotation.selection.anchor.transcriptEntryId === transcriptEntryId
  )
  const pinnedObjectives = state.pinnedObjectives.filter(
    (objective) => objective.selection.anchor.transcriptEntryId === transcriptEntryId
  )
  const selectedTrace = state.selectedTrace?.anchor.transcriptEntryId === transcriptEntryId ? state.selectedTrace : null

  const title = pinnedObjectives[0]?.title ?? selectedTrace?.summary ?? "Trace-grounded workflow draft"
  const summary = pinnedObjectives.length > 0
    ? `Carry ${pinnedObjectives.length} pinned objective${pluralSuffix(pinnedObjectives.length)} into workflow design.`
    : traceAnnotations.length > 0
    ? `Carry ${traceAnnotations.length} trace annotation${pluralSuffix(traceAnnotations.length)} into workflow design.`
    : `Start from ${selectedTrace?.summary.toLowerCase() ?? "the current trace selection"}.`

  return WorkflowHandoffDraft.make({
    annotationIds: traceAnnotations.map((annotation) => annotation.id),
    objectiveIds: pinnedObjectives.map((objective) => objective.id),
    selection: selectedTrace,
    status: pinnedObjectives.length > 0 ? "ready" : "draft",
    summary,
    transcriptEntryId,
    title
  })
})
