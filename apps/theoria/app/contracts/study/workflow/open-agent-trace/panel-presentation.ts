import { Match, Schema } from "effect"

import { type OpenAgentTraceEntryId, taskFirstOpenAgentTraceEntryId } from "./study-material.js"

export const OpenAgentTracePanelGroupKeySchema = Schema.Literal(
  "source",
  "trace",
  "workflow",
  "usage",
  "coverage"
)

export const OpenAgentTracePanelSectionKeySchema = Schema.Literal(
  "corpus-source",
  "redaction-status",
  "digests",
  "active-trace",
  "branch-tree",
  "projected-workflow",
  "workflow-nodes",
  "workflow-edges",
  "evaluation-cases",
  "usage-provenance",
  "coverage-gaps"
)

export const OpenAgentTraceSummaryRowKeySchema = Schema.Literal(
  "records",
  "coverage-gaps",
  "consumer-artifacts",
  "corpus-lane",
  "workflow-hookups"
)

export const OpenAgentTraceSummaryPanelSectionKeySchema = Schema.Literal(
  "corpus-source",
  "redaction-status",
  "digests",
  "projected-workflow"
)

export const OpenAgentTraceDetailsPanelSectionKeySchema = Schema.Literal(
  "active-trace",
  "branch-tree",
  "workflow-nodes",
  "workflow-edges",
  "evaluation-cases",
  "usage-provenance"
)

export const OpenAgentTraceCoveragePanelSectionKeySchema = Schema.Literal("coverage-gaps")

export type OpenAgentTracePanelGroupKey = typeof OpenAgentTracePanelGroupKeySchema.Type
export type OpenAgentTracePanelSectionKey = typeof OpenAgentTracePanelSectionKeySchema.Type
export type OpenAgentTraceSummaryRowKey = typeof OpenAgentTraceSummaryRowKeySchema.Type
export type OpenAgentTraceSummaryPanelSectionKey = typeof OpenAgentTraceSummaryPanelSectionKeySchema.Type
export type OpenAgentTraceDetailsPanelSectionKey = typeof OpenAgentTraceDetailsPanelSectionKeySchema.Type
export type OpenAgentTraceCoveragePanelSectionKey = typeof OpenAgentTraceCoveragePanelSectionKeySchema.Type

export class OpenAgentTracePanelGroupDescriptor extends Schema.Class<OpenAgentTracePanelGroupDescriptor>(
  "OpenAgentTracePanelGroupDescriptor"
)({
  key: OpenAgentTracePanelGroupKeySchema,
  sectionKeys: Schema.Array(OpenAgentTracePanelSectionKeySchema)
}) {
  static forEntryId(entryId: OpenAgentTraceEntryId): ReadonlyArray<OpenAgentTracePanelGroupDescriptor> {
    return Match.value(entryId).pipe(
      Match.when(taskFirstOpenAgentTraceEntryId, () => sharedOpenAgentTracePanelGroups),
      Match.orElse(() => sharedOpenAgentTracePanelGroups)
    )
  }
}

const sharedOpenAgentTracePanelGroups: ReadonlyArray<OpenAgentTracePanelGroupDescriptor> = [
  OpenAgentTracePanelGroupDescriptor.make({
    key: "source",
    sectionKeys: ["corpus-source", "redaction-status", "digests"]
  }),
  OpenAgentTracePanelGroupDescriptor.make({ key: "trace", sectionKeys: ["active-trace", "branch-tree"] }),
  OpenAgentTracePanelGroupDescriptor.make({
    key: "workflow",
    sectionKeys: ["projected-workflow", "workflow-nodes", "workflow-edges"]
  }),
  OpenAgentTracePanelGroupDescriptor.make({ key: "usage", sectionKeys: ["evaluation-cases", "usage-provenance"] }),
  OpenAgentTracePanelGroupDescriptor.make({ key: "coverage", sectionKeys: ["coverage-gaps"] })
]
