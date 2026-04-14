import { Match } from "effect"
import { useState } from "react"

import type { InteractionItem } from "../../../../contracts/presentation/interactions.js"
import { workflowReferenceFromOpenAgentTraceEntry } from "../../../../contracts/study/workflow/catalog.js"
import type { OpenAgentTraceTranscriptModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import {
  openAgentTraceMessageSurfaceModel,
  type OpenAgentTracePanelData
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import { Action } from "../../primitives/interactions/Action.js"
import { InteractionSurface } from "../../primitives/interactions/InteractionSurface.js"
import { MessageContentView } from "../../primitives/interactions/MessageContent.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfacePlaneFrame } from "../../primitives/SurfacePlaneFrame.js"
import { TabBar, TabButton } from "../../primitives/TabBar.js"

import { OpenWorkflowAction } from "./OpenWorkflowAction.js"

const interactionItemId = (item: InteractionItem): string =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => message.id),
    Match.tag("InteractionActionItem", ({ id }) => id),
    Match.exhaustive
  )

const interactionItemsForTranscript = (
  transcript: OpenAgentTraceTranscriptModel
): ReadonlyArray<InteractionItem> => transcript.surface.turns.flatMap((turn) => turn.items)

const selectionSummary = (item: InteractionItem): string =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => `${message.actor.label} · ${message.actor.role} message`),
    Match.tag("InteractionActionItem", ({ action }) => `${action.label} · ${action.kind} action`),
    Match.exhaustive
  )

const SelectedInteractionDetails = ({ item }: { readonly item: InteractionItem }) =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => (
      <Stack className="gap-4">
        <Stack className="gap-1.5">
          <SemanticText
            as="span"
            className="text-ink-500"
            role="row-label"
            text={`${message.actor.role} message`}
            variant="compact"
          />
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="section-title"
            text={message.actor.label}
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={message.timestampLabel ?? "Select adjacent turns to trace sequence context."}
            variant="expanded"
          />
        </Stack>
        <Stack className="gap-3">
          {message.content.map((content, index) => <MessageContentView content={content} key={index} />)}
        </Stack>
      </Stack>
    )),
    Match.tag("InteractionActionItem", ({ action, actor, timestampLabel }) => (
      <Stack className="gap-4">
        <Stack className="gap-1.5">
          <SemanticText
            as="span"
            className="text-ink-500"
            role="row-label"
            text={`${action.kind} action`}
            variant="compact"
          />
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="section-title"
            text={action.label}
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={timestampLabel ?? `${actor.label} invoked this ${action.kind} action.`}
            variant="expanded"
          />
        </Stack>
        <Action action={action} />
      </Stack>
    )),
    Match.exhaustive
  )

export const OpenAgentTraceInteractionWorkspace = ({
  data
}: {
  readonly data: OpenAgentTracePanelData
}) => {
  const model = openAgentTraceMessageSurfaceModel(data)
  const initialTranscript = model.transcripts[0] ?? null
  const [activeEntryId, setActiveEntryId] = useState<string | null>(initialTranscript?.entryId ?? null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const activeTranscript = model.transcripts.find((transcript) => transcript.entryId === activeEntryId) ??
    initialTranscript
  const activeRegistryEntry = activeTranscript === null
    ? null
    : data.registry.find((entry) => entry.entryId === activeTranscript.entryId) ?? null
  const selectedItem = activeTranscript === null
    ? null
    : interactionItemsForTranscript(activeTranscript).find((item) => interactionItemId(item) === selectedItemId) ?? null

  return (
    <Stack className="gap-5">
      <Stack className="gap-2">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text="Interaction canvas"
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text="Browse imported traces as live interaction timelines. Click any message or tool action to inspect its payload, timing, and workflow relevance in context."
          variant="expanded"
        />
      </Stack>

      {activeTranscript === null
        ? (
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={model.description}
            variant="expanded"
          />
        )
        : (
          <Stack className="gap-4">
            <TabBar appearance="flat">
              {model.transcripts.map((transcript) => (
                <TabButton
                  active={transcript.entryId === activeTranscript.entryId}
                  appearance="flat"
                  key={transcript.entryId}
                  label={transcript.title}
                  onClick={() => {
                    setActiveEntryId(transcript.entryId)
                    setSelectedItemId(null)
                  }}
                />
              ))}
            </TabBar>

            <Layer className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)] xl:gap-0">
              <SurfacePlaneFrame
                actions={activeRegistryEntry === null
                  ? undefined
                  : (
                    <OpenWorkflowAction
                      label="Open in workflow"
                      reference={workflowReferenceFromOpenAgentTraceEntry(activeRegistryEntry)}
                    />
                  )}
                className="w-full border-t border-stage-200/82 xl:border-r xl:border-t-0"
                contentClassName="min-h-[28rem] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
                summaryText={activeTranscript.summary}
                title={activeTranscript.title}
                variant="expanded"
              >
                <InteractionSurface
                  model={activeTranscript.surface}
                  onSelectItem={setSelectedItemId}
                  selectedItemId={selectedItemId}
                />
              </SurfacePlaneFrame>

              <SurfacePlaneFrame
                className="w-full border-t border-stage-200/82 xl:border-t-0"
                contentClassName="min-h-[28rem] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
                summaryText={selectedItem === null
                  ? "Select a message or tool action to inspect it without losing your place in the transcript."
                  : selectionSummary(selectedItem)}
                title="Selection"
                variant="expanded"
              >
                {selectedItem === null
                  ? (
                    <SemanticText
                      as="p"
                      className="text-ink-700"
                      role="status"
                      text="Select a message or tool action to inspect its payload, timing, and workflow relevance."
                      variant="expanded"
                    />
                  )
                  : <SelectedInteractionDetails item={selectedItem} />}
              </SurfacePlaneFrame>
            </Layer>
          </Stack>
        )}
    </Stack>
  )
}
