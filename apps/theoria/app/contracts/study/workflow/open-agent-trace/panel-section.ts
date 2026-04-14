import { Match, Option, Schema } from "effect"

import { OpenAgentTraceCoverageItem } from "./coverage-item.js"
import { OpenAgentTraceDetailItem } from "./detail-item.js"
import {
  type OpenAgentTraceCoveragePanelSectionKey,
  OpenAgentTraceCoveragePanelSectionKeySchema,
  type OpenAgentTraceDetailsPanelSectionKey,
  OpenAgentTraceDetailsPanelSectionKeySchema,
  type OpenAgentTracePanelGroupDescriptor,
  OpenAgentTracePanelGroupKeySchema,
  type OpenAgentTraceSummaryPanelSectionKey,
  OpenAgentTraceSummaryPanelSectionKeySchema
} from "./panel-presentation.js"
import { type OpenAgentTraceRegistryEntry } from "./study-material.js"
import { OpenAgentTraceSummaryRow } from "./summary-row.js"

export class OpenAgentTraceSummaryPanelSection extends Schema.TaggedClass<OpenAgentTraceSummaryPanelSection>()(
  "OpenAgentTraceSummaryPanelSection",
  {
    href: Schema.optional(Schema.String),
    key: OpenAgentTraceSummaryPanelSectionKeySchema,
    rows: Schema.Array(OpenAgentTraceSummaryRow),
    title: Schema.String
  }
) {
  static project({
    entry,
    key
  }: {
    readonly entry: OpenAgentTraceRegistryEntry
    readonly key: OpenAgentTraceSummaryPanelSectionKey
  }): OpenAgentTraceSummaryPanelSection {
    return Match.value(key).pipe(
      Match.withReturnType<OpenAgentTraceSummaryPanelSection>(),
      Match.when("corpus-source", () =>
        OpenAgentTraceSummaryPanelSection.make({
          key: "corpus-source",
          rows: OpenAgentTraceSummaryRow.source(entry),
          title: "Corpus Source",
          ...Option.match(Option.fromNullable(entry.record.source.sourceUrl), {
            onNone: () => ({}),
            onSome: (href) => ({ href })
          })
        })),
      Match.when("redaction-status", () =>
        OpenAgentTraceSummaryPanelSection.make({
          key: "redaction-status",
          rows: OpenAgentTraceSummaryRow.redactionStatus(entry),
          title: "Redaction Status"
        })),
      Match.when("digests", () =>
        OpenAgentTraceSummaryPanelSection.make({
          key: "digests",
          rows: OpenAgentTraceSummaryRow.digests(entry),
          title: "Digests"
        })),
      Match.when("projected-workflow", () =>
        OpenAgentTraceSummaryPanelSection.make({
          key: "projected-workflow",
          rows: OpenAgentTraceSummaryRow.workflow(entry),
          title: "Projected Workflow"
        })),
      Match.exhaustive
    )
  }
}

export class OpenAgentTraceDetailsPanelSection extends Schema.TaggedClass<OpenAgentTraceDetailsPanelSection>()(
  "OpenAgentTraceDetailsPanelSection",
  {
    emptyText: Schema.String,
    items: Schema.Array(OpenAgentTraceDetailItem),
    key: OpenAgentTraceDetailsPanelSectionKeySchema,
    title: Schema.String
  }
) {
  static project({
    entry,
    key
  }: {
    readonly entry: OpenAgentTraceRegistryEntry
    readonly key: OpenAgentTraceDetailsPanelSectionKey
  }): OpenAgentTraceDetailsPanelSection {
    return Match.value(key).pipe(
      Match.withReturnType<OpenAgentTraceDetailsPanelSection>(),
      Match.when("active-trace", () =>
        OpenAgentTraceDetailsPanelSection.make({
          emptyText: "No normalized events were preserved.",
          items: OpenAgentTraceDetailItem.events(entry),
          key: "active-trace",
          title: "Active Trace"
        })),
      Match.when("branch-tree", () =>
        OpenAgentTraceDetailsPanelSection.make({
          emptyText: "No abandoned branches were preserved on this active path.",
          items: OpenAgentTraceDetailItem.branches(entry),
          key: "branch-tree",
          title: "Branch Tree"
        })),
      Match.when("workflow-nodes", () =>
        OpenAgentTraceDetailsPanelSection.make({
          emptyText: "No graph nodes were projected.",
          items: OpenAgentTraceDetailItem.workflowNodes(entry),
          key: "workflow-nodes",
          title: "Workflow Nodes"
        })),
      Match.when("workflow-edges", () =>
        OpenAgentTraceDetailsPanelSection.make({
          emptyText: "No graph edges were projected.",
          items: OpenAgentTraceDetailItem.workflowEdges(entry),
          key: "workflow-edges",
          title: "Workflow Edges"
        })),
      Match.when("evaluation-cases", () =>
        OpenAgentTraceDetailsPanelSection.make({
          emptyText: "No workflow evaluation cases were projected.",
          items: OpenAgentTraceDetailItem.workflowCases(entry),
          key: "evaluation-cases",
          title: "Evaluation Cases"
        })),
      Match.when("usage-provenance", () =>
        OpenAgentTraceDetailsPanelSection.make({
          emptyText: "No assistant usage provenance was preserved on this record.",
          items: OpenAgentTraceDetailItem.usage(entry),
          key: "usage-provenance",
          title: "Usage Provenance"
        })),
      Match.exhaustive
    )
  }
}

export class OpenAgentTraceCoveragePanelSection extends Schema.TaggedClass<OpenAgentTraceCoveragePanelSection>()(
  "OpenAgentTraceCoveragePanelSection",
  {
    emptyText: Schema.String,
    items: Schema.Array(OpenAgentTraceCoverageItem),
    key: OpenAgentTraceCoveragePanelSectionKeySchema,
    title: Schema.String
  }
) {
  static project({
    entry,
    key
  }: {
    readonly entry: OpenAgentTraceRegistryEntry
    readonly key: OpenAgentTraceCoveragePanelSectionKey
  }): OpenAgentTraceCoveragePanelSection {
    return OpenAgentTraceCoveragePanelSection.make({
      emptyText: "This projected record emitted no explicit coverage gaps.",
      items: OpenAgentTraceCoverageItem.gaps(entry),
      key,
      title: "Coverage Gaps"
    })
  }
}

export const OpenAgentTracePanelSection = Schema.Union(
  OpenAgentTraceSummaryPanelSection,
  OpenAgentTraceDetailsPanelSection,
  OpenAgentTraceCoveragePanelSection
)

export type OpenAgentTracePanelSection = typeof OpenAgentTracePanelSection.Type

export class OpenAgentTracePanelGroup extends Schema.Class<OpenAgentTracePanelGroup>("OpenAgentTracePanelGroup")({
  key: OpenAgentTracePanelGroupKeySchema,
  sections: Schema.Array(OpenAgentTracePanelSection)
}) {
  private static projectSection({
    entry,
    key
  }: {
    readonly entry: OpenAgentTraceRegistryEntry
    readonly key: OpenAgentTracePanelGroupDescriptor["sectionKeys"][number]
  }): OpenAgentTracePanelSection {
    return Match.value(key).pipe(
      Match.withReturnType<OpenAgentTracePanelSection>(),
      Match.when("corpus-source", () => OpenAgentTraceSummaryPanelSection.project({ entry, key: "corpus-source" })),
      Match.when(
        "redaction-status",
        () => OpenAgentTraceSummaryPanelSection.project({ entry, key: "redaction-status" })
      ),
      Match.when("digests", () => OpenAgentTraceSummaryPanelSection.project({ entry, key: "digests" })),
      Match.when(
        "projected-workflow",
        () => OpenAgentTraceSummaryPanelSection.project({ entry, key: "projected-workflow" })
      ),
      Match.when("active-trace", () => OpenAgentTraceDetailsPanelSection.project({ entry, key: "active-trace" })),
      Match.when("branch-tree", () => OpenAgentTraceDetailsPanelSection.project({ entry, key: "branch-tree" })),
      Match.when("workflow-nodes", () => OpenAgentTraceDetailsPanelSection.project({ entry, key: "workflow-nodes" })),
      Match.when("workflow-edges", () => OpenAgentTraceDetailsPanelSection.project({ entry, key: "workflow-edges" })),
      Match.when(
        "evaluation-cases",
        () => OpenAgentTraceDetailsPanelSection.project({ entry, key: "evaluation-cases" })
      ),
      Match.when(
        "usage-provenance",
        () => OpenAgentTraceDetailsPanelSection.project({ entry, key: "usage-provenance" })
      ),
      Match.when("coverage-gaps", () => OpenAgentTraceCoveragePanelSection.project({ entry, key: "coverage-gaps" })),
      Match.exhaustive
    )
  }

  static project({
    descriptor,
    entry
  }: {
    readonly descriptor: OpenAgentTracePanelGroupDescriptor
    readonly entry: OpenAgentTraceRegistryEntry
  }): OpenAgentTracePanelGroup {
    return OpenAgentTracePanelGroup.make({
      key: descriptor.key,
      sections: descriptor.sectionKeys.map((sectionKey) =>
        OpenAgentTracePanelGroup.projectSection({ entry, key: sectionKey })
      )
    })
  }
}
