import { QueueListIcon } from "@heroicons/react/24/outline"

import { workflowReferenceFromOpenAgentTraceEntry } from "../../../../contracts/study/workflow/catalog.js"
import type {
  OpenAgentTraceRegistryEntry,
  OpenAgentTraceTranscriptModel
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { EmptyState } from "../../../ui/components/feedback/EmptyState.js"
import { Tabs } from "../../../ui/components/navigation/Tabs.js"
import { Panel } from "../../../ui/components/surface/Panel.js"
import { SectionHeader } from "../../../ui/components/surface/SectionHeader.js"
import { Cluster } from "../../../ui/structure/Cluster.js"
import { ScrollRegion } from "../../../ui/structure/ScrollRegion.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { TranscriptTimeline } from "../primitives/TranscriptTimeline.js"
import { OpenInWorkflowAction } from "./OpenInWorkflowAction.js"
import { TranscriptTabs } from "./TranscriptTabs.js"

export const TranscriptCanvas = ({
  activeRegistryEntry,
  activeTranscript,
  onActiveTranscriptChange,
  onSelectItem,
  selectedItemId,
  transcripts
}: {
  readonly activeRegistryEntry: OpenAgentTraceRegistryEntry | null
  readonly activeTranscript: OpenAgentTraceTranscriptModel | null
  readonly onActiveTranscriptChange: (entryId: string) => void
  readonly onSelectItem: (itemId: string) => void
  readonly selectedItemId: string | null
  readonly transcripts: ReadonlyArray<OpenAgentTraceTranscriptModel>
}) => {
  if (activeTranscript === null) {
    return (
      <Panel className="h-full min-h-[32rem]" padding="lg" tone="default">
        <EmptyState
          description="Import or load an open-agent-trace record to populate the interaction canvas."
          eyebrow="Transcript canvas"
          icon={QueueListIcon}
          title="No interaction transcript available"
        />
      </Panel>
    )
  }

  return (
    <Panel className="h-full min-h-[32rem]" padding="sm" tone="default">
      <Tabs.Root
        className="h-full min-h-[30rem]"
        onValueChange={onActiveTranscriptChange}
        value={activeTranscript.entryId}
      >
        <Stack className="h-full" gap="md">
          <SectionHeader
            actions={activeRegistryEntry === null
              ? undefined
              : (
                <OpenInWorkflowAction
                  label="Open in workflow"
                  reference={workflowReferenceFromOpenAgentTraceEntry(activeRegistryEntry)}
                />
              )}
            description={activeTranscript.summary}
            eyebrow="Transcript canvas"
            meta={
              <Cluster gap="sm">
                <Badge tone="neutral">{activeTranscript.eyebrow}</Badge>
                <SemanticText role="label" tone="muted">
                  {`${activeTranscript.surface.turns.length} interaction turn${
                    activeTranscript.surface.turns.length === 1 ? "" : "s"
                  }`}
                </SemanticText>
              </Cluster>
            }
            title={activeTranscript.title}
          />

          <TranscriptTabs transcripts={transcripts} />

          {transcripts.map((transcript) => (
            <Tabs.Panel
              className="min-h-0 flex-1 border-none bg-transparent p-0 shadow-none"
              key={transcript.entryId}
              value={transcript.entryId}
            >
              <ScrollRegion className="h-full pr-1">
                <TranscriptTimeline
                  onSelectItem={onSelectItem}
                  selectedItemId={selectedItemId}
                  surface={transcript.surface}
                />
              </ScrollRegion>
            </Tabs.Panel>
          ))}
        </Stack>
      </Tabs.Root>
    </Panel>
  )
}
