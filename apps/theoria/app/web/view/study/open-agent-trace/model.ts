import { Match } from "effect"

import type { OpenAgentTraceRegistryEntry } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { traceEventItemsFor } from "./event-items.js"
import type { OpenAgentTraceEntryPanelModel, OpenAgentTracePanelModel } from "./panel-types.js"
import { branchItemsFor, digestRowsFor, redactionRowsFor, sourceRowsFor } from "./source-items.js"
import {
  coverageItemsFor,
  graphEdgeItemsFor,
  graphNodeItemsFor,
  usageItemsFor,
  workflowCaseItemsFor,
  workflowRowsFor
} from "./workflow-items.js"

export type {
  CoverageItem,
  DetailItem,
  OpenAgentTraceEntryPanelModel,
  OpenAgentTracePanelModel,
  SummaryRow
} from "./panel-types.js"

const entryModel = (entry: OpenAgentTraceRegistryEntry): OpenAgentTraceEntryPanelModel => ({
  branchItems: branchItemsFor(entry),
  coverageItems: coverageItemsFor(entry),
  digestRows: digestRowsFor(entry),
  entryId: entry.entryId,
  graphEdgeItems: graphEdgeItemsFor(entry),
  graphNodeItems: graphNodeItemsFor(entry),
  redactionRows: redactionRowsFor(entry),
  sourceHref: entry.record.source.sourceUrl,
  sourceRows: sourceRowsFor(entry),
  summary: entry.summary,
  title: entry.title,
  traceEventItems: traceEventItemsFor(entry),
  usageItems: usageItemsFor(entry),
  workflowCaseItems: workflowCaseItemsFor(entry),
  workflowRows: workflowRowsFor(entry)
})

export const openAgentTracePanelModel = (
  entries: ReadonlyArray<OpenAgentTraceRegistryEntry>
): OpenAgentTracePanelModel => ({
  entries: entries.map(entryModel),
  summaryRows: [
    { label: "Records", value: String(entries.length) },
    {
      label: "Coverage Gaps",
      value: String(entries.reduce((total, entry) => total + entry.workflowProjection.coverageGaps.length, 0))
    },
    {
      label: "Experimental Surface",
      value: Match.value(entries.length > 0).pipe(
        Match.when(true, () => "fixture-backed"),
        Match.when(false, () => "empty"),
        Match.exhaustive
      )
    }
  ]
})
