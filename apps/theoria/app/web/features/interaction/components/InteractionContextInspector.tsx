import { RectangleGroupIcon, Squares2X2Icon } from "@heroicons/react/24/outline"
import type {
  InteractionAnnotationDraft,
  InteractionInspectorPanel,
  InteractionItem,
  PinnedObjective,
  TraceAnnotation,
  TraceAnnotationKind,
  TraceSelection,
  WorkflowHandoffDraft
} from "../../../../contracts/presentation/interactions.js"
import type {
  OpenAgentTraceEntryPanelModel,
  OpenAgentTraceStudyMaterialCardModel
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import { InspectorEmptyState } from "../../../ui/components/inspector/InspectorEmptyState.js"
import { InspectorSection } from "../../../ui/components/inspector/InspectorSection.js"
import { InspectorSummaryBlock } from "../../../ui/components/inspector/InspectorSummaryBlock.js"
import { InspectorTabs } from "../../../ui/components/inspector/InspectorTabs.js"
import { InteractionInspector } from "../../../ui/components/interaction/InteractionInspector.js"
import { PinnedObjectivePanel } from "../../../ui/components/interaction/PinnedObjectivePanel.js"
import { TraceAnnotationComposer } from "../../../ui/components/interaction/TraceAnnotationComposer.js"
import { TraceAnnotationList } from "../../../ui/components/interaction/TraceAnnotationList.js"
import { WorkflowHandoffAction } from "../../../ui/components/interaction/WorkflowHandoffAction.js"
import { Box } from "../../../ui/structure/Box.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { SelectionDetails } from "./SelectionDetails.js"
import { StudyMaterialPanel } from "./StudyMaterialPanel.js"
import { TraceRecordGroupTabs } from "./TraceRecordGroupTabs.js"

const inspectorSummary = (panel: InteractionInspectorPanel): string =>
  panel === "selection"
    ? "Inspect the selected trace moment and turn it into explicit study intent."
    : panel === "annotations"
    ? "Annotations and pinned objectives keep the interaction study grounded in concrete trace evidence."
    : panel === "trace"
    ? "Trace provenance and workflow projection stay contextual instead of competing with the transcript."
    : "Imported study materials stay available as supporting evidence for the current trace lane."

export const InteractionContextInspector = ({
  activeEntry,
  activePanel,
  annotationDraft,
  handoffDraft,
  objectives,
  onAnnotationDraftKindChange,
  onAnnotationDraftLabelChange,
  onAnnotationDraftNoteChange,
  onCreateAnnotation,
  onInspectorPanelChange,
  onOpenWorkflowHandoff,
  onPinAnnotationObjective,
  onPrepareWorkflowFromObjective,
  onRemoveAnnotation,
  onRemoveObjective,
  onSelectAnnotation,
  selectedAnnotationId,
  selectedItem,
  selection,
  studyMaterials,
  traceAnnotations
}: {
  readonly activeEntry: OpenAgentTraceEntryPanelModel | null
  readonly activePanel: InteractionInspectorPanel
  readonly annotationDraft: InteractionAnnotationDraft
  readonly handoffDraft: WorkflowHandoffDraft | null
  readonly objectives: ReadonlyArray<PinnedObjective>
  readonly onAnnotationDraftKindChange: (kind: TraceAnnotationKind) => void
  readonly onAnnotationDraftLabelChange: (value: string) => void
  readonly onAnnotationDraftNoteChange: (value: string) => void
  readonly onCreateAnnotation: () => void
  readonly onInspectorPanelChange: (panel: InteractionInspectorPanel) => void
  readonly onOpenWorkflowHandoff?: (draft: WorkflowHandoffDraft) => void
  readonly onPinAnnotationObjective: (annotation: TraceAnnotation) => void
  readonly onPrepareWorkflowFromObjective: (objective: PinnedObjective) => void
  readonly onRemoveAnnotation: (annotationId: string) => void
  readonly onRemoveObjective: (objectiveId: string) => void
  readonly onSelectAnnotation: (annotationId: string) => void
  readonly selectedAnnotationId: string | null
  readonly selectedItem: InteractionItem | null
  readonly selection: TraceSelection | null
  readonly studyMaterials: ReadonlyArray<OpenAgentTraceStudyMaterialCardModel>
  readonly traceAnnotations: ReadonlyArray<TraceAnnotation>
}) => (
  <InteractionInspector
    label="Interaction context"
    summary={inspectorSummary(activePanel)}
    title="Inspector"
  >
    <Stack gap="md">
      <InspectorSection>
        <WorkflowHandoffAction
          draft={handoffDraft}
          {...(onOpenWorkflowHandoff === undefined ? {} : { onPress: onOpenWorkflowHandoff })}
        />
      </InspectorSection>
      <InspectorSection>
        <PinnedObjectivePanel
          objectives={objectives}
          onPrepareWorkflow={onPrepareWorkflowFromObjective}
          onRemove={onRemoveObjective}
        />
      </InspectorSection>
      <Box className="px-[var(--ui-workspace-pane-padding-x)]">
        <InspectorTabs.Root
          onValueChange={(value) => {
            if (
              value === "selection" ||
              value === "annotations" ||
              value === "trace" ||
              value === "materials"
            ) {
              onInspectorPanelChange(value)
            }
          }}
          value={activePanel}
        >
          <Stack gap="md">
            <InspectorTabs.List aria-label="Interaction inspector panels">
              <InspectorTabs.Indicator />
              <InspectorTabs.Tab value="selection">Selection</InspectorTabs.Tab>
              <InspectorTabs.Tab value="annotations">Annotations</InspectorTabs.Tab>
              <InspectorTabs.Tab value="trace">Trace</InspectorTabs.Tab>
              <InspectorTabs.Tab value="materials">Materials</InspectorTabs.Tab>
            </InspectorTabs.List>
            <InspectorTabs.Panel value="selection">
              <Stack gap="md">
                {selection === null
                  ? null
                  : <InspectorSummaryBlock summary={selection.quote ?? selection.summary} title={selection.summary} />}
                <SelectionDetails item={selectedItem} />
              </Stack>
            </InspectorTabs.Panel>
            <InspectorTabs.Panel value="annotations">
              <Stack gap="md">
                <TraceAnnotationComposer
                  kind={annotationDraft.kind}
                  label={annotationDraft.label}
                  note={annotationDraft.note}
                  onCreate={onCreateAnnotation}
                  onKindChange={onAnnotationDraftKindChange}
                  onLabelChange={onAnnotationDraftLabelChange}
                  onNoteChange={onAnnotationDraftNoteChange}
                  selection={selection}
                />
                <TraceAnnotationList
                  onPinObjective={onPinAnnotationObjective}
                  onRemove={onRemoveAnnotation}
                  onSelect={onSelectAnnotation}
                  selectedAnnotationId={selectedAnnotationId}
                  traceAnnotations={traceAnnotations}
                />
              </Stack>
            </InspectorTabs.Panel>
            <InspectorTabs.Panel value="trace">
              {activeEntry === null
                ? (
                  <InspectorEmptyState
                    icon={RectangleGroupIcon}
                    summary="Choose an imported transcript to inspect its projected trace record and workflow handoff details."
                    title="No active trace record"
                  />
                )
                : <TraceRecordGroupTabs entry={activeEntry} />}
            </InspectorTabs.Panel>
            <InspectorTabs.Panel value="materials">
              {studyMaterials.length === 0
                ? (
                  <InspectorEmptyState
                    icon={Squares2X2Icon}
                    summary="No study materials are currently published for this corpus lane."
                    title="No study materials available"
                  />
                )
                : (
                  <Stack gap="md">
                    {studyMaterials.map((material) => <StudyMaterialPanel key={material.key} material={material} />)}
                  </Stack>
                )}
            </InspectorTabs.Panel>
          </Stack>
        </InspectorTabs.Root>
      </Box>
    </Stack>
  </InteractionInspector>
)
