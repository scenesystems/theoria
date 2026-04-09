import { Schema } from "effect"

import type { OpenAgentTracePanelData } from "../../../contracts/study/workflow/open-agent-trace.js"

import { OpenAgentTraceCorpusLane } from "./open-agent-trace-corpus-lane.js"
import { OpenAgentTraceSummaryRow } from "./open-agent-trace-summary-row.js"

export class OpenAgentTraceSummary extends Schema.Class<OpenAgentTraceSummary>("OpenAgentTraceSummary")({
  corpusLane: OpenAgentTraceCorpusLane,
  description: Schema.String,
  rows: Schema.Array(OpenAgentTraceSummaryRow)
}) {
  static project(data: OpenAgentTracePanelData): OpenAgentTraceSummary {
    const corpusLane = OpenAgentTraceCorpusLane.project(data.registry)

    return OpenAgentTraceSummary.make({
      corpusLane,
      description: corpusLane.description(),
      rows: OpenAgentTraceSummaryRow.summarize({ corpusLane, data })
    })
  }
}
