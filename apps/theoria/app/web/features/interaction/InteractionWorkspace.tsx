import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { HashSet } from "effect"

import type { WorkflowHandoffDraft } from "../../../contracts/presentation/interactions.js"
import { WorkflowStudyRoute } from "../../../contracts/presentation/path.js"
import { workflowReferenceFromOpenAgentTraceEntry } from "../../../contracts/study/workflow/catalog.js"
import { WorkflowStudyInput } from "../../../contracts/study/workflow/input.js"
import {
  openAgentTraceMessageSurfaceModel,
  OpenAgentTracePanelModel
} from "../../../contracts/study/workflow/open-agent-trace.js"
import {
  createInteractionAnnotationAtom,
  interactionComposerContextAtom,
  interactionWorkflowHandoffDraftAtom,
  interactionWorkspaceStateAtom,
  pinInteractionAnnotationObjectiveAtom,
  pinSelectedInteractionObjectiveAtom,
  removeTraceAnnotationAtom,
  selectInteractionAnnotationAtom,
  selectInteractionTraceAtom,
  setInteractionActiveTranscriptAtom,
  setInteractionAnnotationDraftKindAtom,
  setInteractionAnnotationDraftLabelAtom,
  setInteractionAnnotationDraftNoteAtom,
  setInteractionComposerDraftAtom,
  setInteractionInspectorPanelAtom,
  unpinInteractionObjectiveAtom
} from "../../atoms/interaction/interaction-workspace.js"
import { openAgentTracePanelAtom } from "../../atoms/workflow/open-agent-trace.js"
import { Badge } from "../../ui/components/feedback/Badge.js"
import { Skeleton } from "../../ui/components/feedback/Skeleton.js"
import { InteractionWorkspaceShell } from "../../ui/components/interaction/InteractionWorkspaceShell.js"
import { Callout } from "../../ui/components/surface/Callout.js"
import { Stack } from "../../ui/structure/Stack.js"

import { InteractionContextInspector } from "./components/InteractionContextInspector.js"
import { InteractionImportStrip } from "./components/InteractionImportStrip.js"
import { InteractionTranscriptSurface } from "./components/InteractionTranscriptSurface.js"
import {
  corpusLaneLabel,
  corpusLaneTone,
  interactionItemId,
  interactionItemsForTranscript,
  traceSelectionForTranscriptItem
} from "./model.js"

const InteractionWorkspaceLoadingState = () => (
  <Stack gap="md">
    <Skeleton className="h-5 w-40" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-[32rem] w-full" />
  </Stack>
)

export const InteractionWorkspace = () => {
  const composerContext = useAtomValue(interactionComposerContextAtom)
  const handoffDraft = useAtomValue(interactionWorkflowHandoffDraftAtom)
  const panelResult = useAtomValue(openAgentTracePanelAtom)
  const workspaceState = useAtomValue(interactionWorkspaceStateAtom)
  const createAnnotation = useAtomSet(createInteractionAnnotationAtom)
  const pinAnnotationObjective = useAtomSet(pinInteractionAnnotationObjectiveAtom)
  const pinSelectedObjective = useAtomSet(pinSelectedInteractionObjectiveAtom)
  const removeAnnotation = useAtomSet(removeTraceAnnotationAtom)
  const removeObjective = useAtomSet(unpinInteractionObjectiveAtom)
  const selectAnnotation = useAtomSet(selectInteractionAnnotationAtom)
  const selectTrace = useAtomSet(selectInteractionTraceAtom)
  const setActiveTranscript = useAtomSet(setInteractionActiveTranscriptAtom)
  const setAnnotationDraftKind = useAtomSet(setInteractionAnnotationDraftKindAtom)
  const setAnnotationDraftLabel = useAtomSet(setInteractionAnnotationDraftLabelAtom)
  const setAnnotationDraftNote = useAtomSet(setInteractionAnnotationDraftNoteAtom)
  const setComposerDraft = useAtomSet(setInteractionComposerDraftAtom)
  const setInspectorPanel = useAtomSet(setInteractionInspectorPanelAtom)

  return Result.match(panelResult, {
    onInitial: () => <InteractionWorkspaceLoadingState />,
    onFailure: (failure) => (
      <Callout
        description={failure.cause.toString()}
        icon={ExclamationTriangleIcon}
        title="Unable to load interaction workspace"
        tone="danger"
      />
    ),
    onSuccess: (success) => {
      const messageModel = openAgentTraceMessageSurfaceModel(success.value)
      const panelModel = OpenAgentTracePanelModel.project(success.value)
      const initialTranscript = messageModel.transcripts[0] ?? null
      const activeTranscript = messageModel.transcripts.find(
        (transcript) => transcript.entryId === workspaceState.activeTranscriptEntryId
      ) ?? initialTranscript
      const activeEntry = activeTranscript === null
        ? null
        : panelModel.entries.find((entry) => entry.entryId === activeTranscript.entryId) ?? null
      const activeRegistryEntry = activeTranscript === null
        ? null
        : success.value.registry.find((entry) => entry.entryId === activeTranscript.entryId) ?? null
      const selectedItemId = workspaceState.selectedTrace?.anchor.itemId ?? null
      const selectedItem = activeTranscript === null
        ? null
        : interactionItemsForTranscript(activeTranscript).find((item) => interactionItemId(item) === selectedItemId) ??
          null
      const annotatedItemIds = HashSet.fromIterable(
        workspaceState.traceAnnotations.map((annotation) => annotation.selection.anchor.itemId)
      )
      const objectiveItemIds = HashSet.fromIterable(
        workspaceState.pinnedObjectives.map((objective) => objective.selection.anchor.itemId)
      )

      return (
        <InteractionWorkspaceShell
          actions={handoffDraft === null ? undefined : <Badge tone="attention">{handoffDraft.status}</Badge>}
          inspector={
            <InteractionContextInspector
              activeEntry={activeEntry}
              activePanel={workspaceState.activeInspectorPanel}
              annotationDraft={workspaceState.annotationDraft}
              handoffDraft={handoffDraft}
              objectives={workspaceState.pinnedObjectives}
              onAnnotationDraftKindChange={setAnnotationDraftKind}
              onAnnotationDraftLabelChange={setAnnotationDraftLabel}
              onAnnotationDraftNoteChange={setAnnotationDraftNote}
              onCreateAnnotation={() => {
                createAnnotation(undefined)
              }}
              onInspectorPanelChange={setInspectorPanel}
              {...(handoffDraft === null
                ? {}
                : {
                  onOpenWorkflowHandoff: (draft: WorkflowHandoffDraft) => {
                    const workflowReference = success.value.registry.find(
                      (entry) => entry.entryId === draft.transcriptEntryId
                    )

                    if (workflowReference !== undefined) {
                      window.location.assign(
                        WorkflowStudyRoute.fromSessionId(
                          workflowReferenceFromOpenAgentTraceEntry(workflowReference).seedId,
                          WorkflowStudyInput.withHandoff(draft)
                        ).path()
                      )
                    }
                  }
                })}
              onPinAnnotationObjective={(annotation) => {
                pinAnnotationObjective(annotation.id)
              }}
              onPrepareWorkflowFromObjective={(objective) => {
                selectTrace(objective.selection)
              }}
              onRemoveAnnotation={removeAnnotation}
              onRemoveObjective={removeObjective}
              onSelectAnnotation={selectAnnotation}
              selectedAnnotationId={workspaceState.selectedAnnotationId}
              selectedItem={selectedItem}
              selection={workspaceState.selectedTrace}
              studyMaterials={panelModel.studyMaterials}
              traceAnnotations={workspaceState.traceAnnotations}
            />
          }
          label="Interaction workspace"
          statusItems={[
            <Badge key="lane" tone={corpusLaneTone(panelModel.corpusLane.label)}>
              {corpusLaneLabel(panelModel.corpusLane.label)}
            </Badge>,
            `${messageModel.transcripts.length} transcript${messageModel.transcripts.length === 1 ? "" : "s"}`,
            `${workspaceState.traceAnnotations.length} annotation${
              workspaceState.traceAnnotations.length === 1 ? "" : "s"
            }`,
            `${workspaceState.pinnedObjectives.length} objective${
              workspaceState.pinnedObjectives.length === 1 ? "" : "s"
            }`
          ]}
          stripBody={<InteractionImportStrip />}
          summary="Read imported traces as the primary study surface, annotate failures and opportunities, pin objectives, and carry them forward into workflow design."
          title="Trace-native interaction study"
          transcript={
            <InteractionTranscriptSurface
              activeRegistryEntry={activeRegistryEntry}
              activeTranscript={activeTranscript}
              annotatedItemIds={annotatedItemIds}
              composerContext={composerContext}
              composerDraft={workspaceState.composerDraft}
              objectiveItemIds={objectiveItemIds}
              onActiveTranscriptChange={setActiveTranscript}
              onAnnotate={() => {
                setInspectorPanel("annotations")
              }}
              onClearSelection={() => {
                selectTrace(null)
              }}
              onComposerDraftChange={setComposerDraft}
              onComposerReset={() => {
                setComposerDraft("")
              }}
              onComposerSubmit={() => {
                setInspectorPanel("annotations")
              }}
              onPinObjective={() => {
                pinSelectedObjective(undefined)
              }}
              onSelectItem={(_itemId, turnId, item) => {
                if (activeTranscript !== null) {
                  selectTrace(
                    traceSelectionForTranscriptItem({
                      item,
                      transcriptEntryId: activeTranscript.entryId,
                      turnId
                    })
                  )
                }
              }}
              selectedItemId={selectedItemId}
              selectedTrace={workspaceState.selectedTrace}
              transcripts={messageModel.transcripts}
            />
          }
        />
      )
    }
  })
}
