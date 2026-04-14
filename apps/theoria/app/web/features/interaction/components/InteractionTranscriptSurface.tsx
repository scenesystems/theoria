import type { HashSet } from "effect"

import type {
  InteractionComposerContext,
  InteractionItem,
  TraceSelection
} from "../../../../contracts/presentation/interactions.js"
import { workflowReferenceFromOpenAgentTraceEntry } from "../../../../contracts/study/workflow/catalog.js"
import type {
  OpenAgentTraceRegistryEntry,
  OpenAgentTraceTranscriptModel
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import { EmptyState } from "../../../ui/components/feedback/EmptyState.js"
import { InteractionTranscriptCanvas } from "../../../ui/components/interaction/InteractionTranscriptCanvas.js"
import { TraceAwareAgentComposer } from "../../../ui/components/interaction/TraceAwareAgentComposer.js"
import { TraceSelectionToolbar } from "../../../ui/components/interaction/TraceSelectionToolbar.js"
import { TranscriptTabs } from "../../../ui/components/transcript/TranscriptTabs.js"
import { Box } from "../../../ui/structure/Box.js"
import { ScrollRegion } from "../../../ui/structure/ScrollRegion.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { InteractionTranscriptTimeline } from "./InteractionTranscriptTimeline.js"
import { OpenInWorkflowAction } from "./OpenInWorkflowAction.js"

export const InteractionTranscriptSurface = ({
  activeRegistryEntry,
  activeTranscript,
  annotatedItemIds,
  composerContext,
  composerDraft,
  objectiveItemIds,
  onActiveTranscriptChange,
  onAnnotate,
  onClearSelection,
  onComposerDraftChange,
  onComposerReset,
  onComposerSubmit,
  onPinObjective,
  onSelectItem,
  selectedItemId,
  selectedTrace,
  transcripts
}: {
  readonly activeRegistryEntry: OpenAgentTraceRegistryEntry | null
  readonly activeTranscript: OpenAgentTraceTranscriptModel | null
  readonly annotatedItemIds: HashSet.HashSet<string>
  readonly composerContext: InteractionComposerContext
  readonly composerDraft: string
  readonly objectiveItemIds: HashSet.HashSet<string>
  readonly onActiveTranscriptChange: (entryId: string) => void
  readonly onAnnotate: () => void
  readonly onClearSelection: () => void
  readonly onComposerDraftChange: (value: string) => void
  readonly onComposerReset: () => void
  readonly onComposerSubmit: () => void
  readonly onPinObjective: () => void
  readonly onSelectItem: (itemId: string, turnId: string, item: InteractionItem) => void
  readonly selectedItemId: string | null
  readonly selectedTrace: TraceSelection | null
  readonly transcripts: ReadonlyArray<OpenAgentTraceTranscriptModel>
}) => (
  <InteractionTranscriptCanvas
    actions={activeRegistryEntry === null
      ? undefined
      : (
        <OpenInWorkflowAction
          label="Open imported workflow"
          reference={workflowReferenceFromOpenAgentTraceEntry(activeRegistryEntry)}
        />
      )}
    composer={
      <TraceAwareAgentComposer
        composerContext={composerContext}
        onReset={onComposerReset}
        onSubmit={onComposerSubmit}
        onValueChange={onComposerDraftChange}
        value={composerDraft}
      />
    }
    label={activeTranscript?.eyebrow ?? "Interaction transcript"}
    summary={activeTranscript?.summary ??
      "Import or resume a trace to begin reading, annotating, and shaping study intent."}
    title={activeTranscript?.title ?? "No interaction transcript selected"}
    toolbar={
      <TraceSelectionToolbar
        onAnnotate={onAnnotate}
        onClearSelection={onClearSelection}
        onPinObjective={onPinObjective}
        selection={selectedTrace}
      />
    }
  >
    {activeTranscript === null
      ? (
        <Box className="px-[var(--ui-workspace-pane-padding-x)] py-[var(--ui-workspace-pane-padding-y)]">
          <EmptyState
            description="Import or load an open-agent-trace record to populate the interaction workspace."
            eyebrow="Transcript"
            title="No interaction transcript available"
          />
        </Box>
      )
      : (
        <TranscriptTabs.Root onValueChange={onActiveTranscriptChange} value={activeTranscript.entryId}>
          <Stack className="h-full" gap="md">
            <Box className="border-b border-border-pane px-[var(--ui-workspace-pane-padding-x)] py-3">
              <ScrollRegion direction="horizontal">
                <TranscriptTabs.List aria-label="Interaction transcripts">
                  <TranscriptTabs.Indicator />
                  {transcripts.map((transcript) => (
                    <TranscriptTabs.Tab key={transcript.entryId} value={transcript.entryId}>
                      {transcript.title}
                    </TranscriptTabs.Tab>
                  ))}
                </TranscriptTabs.List>
              </ScrollRegion>
            </Box>
            {transcripts.map((transcript) => (
              <TranscriptTabs.Panel className="min-h-0 flex-1" key={transcript.entryId} value={transcript.entryId}>
                <ScrollRegion className="h-full px-[var(--ui-workspace-pane-padding-x)] pb-[var(--ui-workspace-pane-padding-y)]">
                  <InteractionTranscriptTimeline
                    annotatedItemIds={annotatedItemIds}
                    objectiveItemIds={objectiveItemIds}
                    onSelectItem={onSelectItem}
                    selectedItemId={selectedItemId}
                    surface={transcript.surface}
                    transcriptEntryId={transcript.entryId}
                  />
                </ScrollRegion>
              </TranscriptTabs.Panel>
            ))}
          </Stack>
        </TranscriptTabs.Root>
      )}
  </InteractionTranscriptCanvas>
)
