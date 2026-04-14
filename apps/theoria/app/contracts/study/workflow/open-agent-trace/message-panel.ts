import { Schema } from "effect"

import { InteractionSurfaceModel, interactionSurfaceModel } from "../../../presentation/interactions.js"

import { OpenAgentTraceCorpusLane } from "./corpus-lane.js"
import { interactionItemsForEvent } from "./message-panel-message.js"
import type { OpenAgentTracePanelData, OpenAgentTraceRegistryEntry } from "./study-material.js"

export class OpenAgentTraceTranscriptModel extends Schema.Class<OpenAgentTraceTranscriptModel>(
  "OpenAgentTraceTranscriptModel"
)({
  eyebrow: Schema.String,
  entryId: Schema.String,
  surface: InteractionSurfaceModel,
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
    surface: interactionSurfaceModel({
      emptyText: "No normalized interactions were preserved for this trace.",
      items: entry.record.events.flatMap(interactionItemsForEvent)
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
