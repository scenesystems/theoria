import type { InteractionItem } from "../../../../contracts/presentation/interactions.js"
import type {
  OpenAgentTraceMessageSurfaceModel,
  OpenAgentTracePanelData,
  OpenAgentTracePanelModel
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import type { InteractionInspectorMode } from "../../../atoms/interaction/open-agent-trace-workspace.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { SectionHeader } from "../../../ui/components/surface/SectionHeader.js"
import { InspectorLayout } from "../../../ui/patterns/InspectorLayout.js"
import { WorkspaceFrame } from "../../../ui/patterns/WorkspaceFrame.js"
import { Cluster } from "../../../ui/structure/Cluster.js"
import { Grid } from "../../../ui/structure/Grid.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { corpusLaneLabel, corpusLaneTone, interactionItemId, interactionItemsForTranscript } from "../model.js"

import { InteractionInspector } from "./InteractionInspector.js"
import { StudyMaterialPanel } from "./StudyMaterialPanel.js"
import { TraceRecordPanel } from "./TraceRecordPanel.js"
import { TranscriptCanvas } from "./TranscriptCanvas.js"

export const OpenAgentTraceWorkspace = ({
  activeEntryId,
  data,
  inspectorMode,
  messageModel,
  onActiveEntryChange,
  onInspectorModeChange,
  onSelectItem,
  panelModel,
  selectedItemId
}: {
  readonly activeEntryId: string | null
  readonly data: OpenAgentTracePanelData
  readonly inspectorMode: InteractionInspectorMode
  readonly messageModel: OpenAgentTraceMessageSurfaceModel
  readonly onActiveEntryChange: (entryId: string) => void
  readonly onInspectorModeChange: (mode: InteractionInspectorMode) => void
  readonly onSelectItem: (itemId: string) => void
  readonly panelModel: OpenAgentTracePanelModel
  readonly selectedItemId: string | null
}) => {
  const initialTranscript = messageModel.transcripts[0] ?? null
  const activeTranscript = messageModel.transcripts.find((transcript) => transcript.entryId === activeEntryId) ??
    initialTranscript
  const activeEntry = activeTranscript === null
    ? null
    : panelModel.entries.find((entry) => entry.entryId === activeTranscript.entryId) ?? null
  const activeRegistryEntry = activeTranscript === null
    ? null
    : data.registry.find((entry) => entry.entryId === activeTranscript.entryId) ?? null
  const selectedItem: InteractionItem | null = activeTranscript === null
    ? null
    : interactionItemsForTranscript(activeTranscript).find((item) => interactionItemId(item) === selectedItemId) ?? null

  return (
    <Stack gap="lg">
      <WorkspaceFrame
        bodyClassName="min-h-0 overflow-hidden"
        header={
          <SectionHeader
            description="Turn imported traces into navigable transcript evidence, then inspect workflow handoffs and study material without replacing the current study shell."
            eyebrow="Interaction workspace"
            title="Open-agent-trace evidence"
          />
        }
        status={
          <Cluster gap="sm">
            <Badge tone={corpusLaneTone(panelModel.corpusLane.label)}>
              {corpusLaneLabel(panelModel.corpusLane.label)}
            </Badge>
            <SemanticText role="label" tone="muted">
              {`${messageModel.transcripts.length} transcript${messageModel.transcripts.length === 1 ? "" : "s"}`}
            </SemanticText>
            <SemanticText role="label" tone="muted">
              {`${panelModel.studyMaterials.length} study material lane${
                panelModel.studyMaterials.length === 1 ? "" : "s"
              }`}
            </SemanticText>
          </Cluster>
        }
      >
        <InspectorLayout
          className="min-h-[36rem]"
          inspector={
            <InteractionInspector
              activeEntry={activeEntry}
              mode={inspectorMode}
              onModeChange={onInspectorModeChange}
              selectedItem={selectedItem}
              studyMaterials={panelModel.studyMaterials}
            />
          }
          main={
            <TranscriptCanvas
              activeRegistryEntry={activeRegistryEntry}
              activeTranscript={activeTranscript}
              onActiveTranscriptChange={onActiveEntryChange}
              onSelectItem={onSelectItem}
              selectedItemId={selectedItemId}
              transcripts={messageModel.transcripts}
            />
          }
        />
      </WorkspaceFrame>

      <TraceRecordPanel model={panelModel} />

      <Grid columns={2} gap="md">
        {panelModel.studyMaterials.map((material) => <StudyMaterialPanel key={material.key} material={material} />)}
      </Grid>
    </Stack>
  )
}
