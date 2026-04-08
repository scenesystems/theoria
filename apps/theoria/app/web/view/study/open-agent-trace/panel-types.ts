import type { OpenAgentTraceRegistryEntry } from "../../../../contracts/study/workflow/open-agent-trace.js"

export type SummaryRow = {
  readonly label: string
  readonly value: string
}

export type DetailItem = {
  readonly detail: string
  readonly label: string
}

export type CoverageItem = DetailItem & {
  readonly severity: string
}

export type OpenAgentTraceEntryPanelModel = {
  readonly branchItems: ReadonlyArray<DetailItem>
  readonly coverageItems: ReadonlyArray<CoverageItem>
  readonly digestRows: ReadonlyArray<SummaryRow>
  readonly entryId: OpenAgentTraceRegistryEntry["entryId"]
  readonly graphEdgeItems: ReadonlyArray<DetailItem>
  readonly graphNodeItems: ReadonlyArray<DetailItem>
  readonly redactionRows: ReadonlyArray<SummaryRow>
  readonly sourceHref: string
  readonly sourceRows: ReadonlyArray<SummaryRow>
  readonly summary: string
  readonly title: string
  readonly traceEventItems: ReadonlyArray<DetailItem>
  readonly usageItems: ReadonlyArray<DetailItem>
  readonly workflowCaseItems: ReadonlyArray<DetailItem>
  readonly workflowRows: ReadonlyArray<SummaryRow>
}

export type OpenAgentTracePanelModel = {
  readonly entries: ReadonlyArray<OpenAgentTraceEntryPanelModel>
  readonly summaryRows: ReadonlyArray<SummaryRow>
}
