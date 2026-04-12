import { Schema } from "effect"

import { MessagePanelModel } from "../../../presentation/interactions.js"

import { OpenAgentTraceCorpusLane } from "./corpus-lane.js"
import { messageForEvent } from "./message-panel-message.js"
import type { OpenAgentTracePanelData, OpenAgentTraceRegistryEntry } from "./study-material.js"

export class OpenAgentTraceTranscriptModel extends Schema.Class<OpenAgentTraceTranscriptModel>(
  "OpenAgentTraceTranscriptModel"
)({
  eyebrow: Schema.String,
  entryId: Schema.String,
  panel: MessagePanelModel,
  summary: Schema.String,
  title: Schema.String
}) {}

export class OpenAgentTraceMessageSurfaceModel extends Schema.Class<OpenAgentTraceMessageSurfaceModel>(
  "OpenAgentTraceMessageSurfaceModel"
)({
  description: Schema.String,
  transcripts: Schema.Array(OpenAgentTraceTranscriptModel)
}) {}

const transcriptModelFor = (entry: OpenAgentTraceRegistryEntry): OpenAgentTraceTranscriptModel =>
  OpenAgentTraceTranscriptModel.make({
    eyebrow: entry.eyebrow,
    entryId: entry.entryId,
    panel: MessagePanelModel.make({
      emptyText: "No normalized messages were preserved for this trace.",
      messages: entry.record.events.map(messageForEvent)
    }),
    summary: entry.summary,
    title: entry.title
  })

export const openAgentTraceMessageSurfaceModel = (
  data: OpenAgentTracePanelData
): OpenAgentTraceMessageSurfaceModel => {
  const corpusLane = OpenAgentTraceCorpusLane.project(data.registry)

  return OpenAgentTraceMessageSurfaceModel.make({
    description: corpusLane.description(),
    transcripts: data.registry.map(transcriptModelFor)
  })
}
