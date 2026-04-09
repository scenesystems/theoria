import { Match, Schema } from "effect"

import {
  type OpenAgentTraceConsumerArtifactStudyMaterial,
  OpenAgentTraceEntryIdSchema,
  type OpenAgentTracePanelData,
  OpenAgentTracePanelGroupDescriptor,
  type OpenAgentTraceRegistryEntry,
  type OpenAgentTraceStudyMaterial,
  OpenAgentTraceStudyMaterialLaneSchema,
  type OpenAgentTraceWorkflowHookupStudyMaterial
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import { OpenAgentTraceCorpusLane } from "../../../state/workflow/open-agent-trace-corpus-lane.js"
import { OpenAgentTraceDetailItem } from "../../../state/workflow/open-agent-trace-detail-item.js"
import { OpenAgentTraceSummaryRow } from "../../../state/workflow/open-agent-trace-summary-row.js"
import { OpenAgentTraceSummary } from "../../../state/workflow/open-agent-trace-summary.js"
import { OpenAgentTracePanelGroup } from "./panel-sections.js"

export class OpenAgentTraceEntryPanelModel extends Schema.Class<OpenAgentTraceEntryPanelModel>(
  "OpenAgentTraceEntryPanelModel"
)({
  eyebrow: Schema.String,
  entryId: OpenAgentTraceEntryIdSchema,
  groups: Schema.Array(OpenAgentTracePanelGroup),
  summary: Schema.String,
  title: Schema.String
}) {
  private static groups(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTracePanelGroup> {
    return OpenAgentTracePanelGroupDescriptor.forEntryId(entry.entryId).map((descriptor) =>
      OpenAgentTracePanelGroup.project({ descriptor, entry })
    )
  }

  static project(entry: OpenAgentTraceRegistryEntry): OpenAgentTraceEntryPanelModel {
    return OpenAgentTraceEntryPanelModel.make({
      entryId: entry.entryId,
      eyebrow: entry.eyebrow,
      groups: OpenAgentTraceEntryPanelModel.groups(entry),
      summary: entry.summary,
      title: entry.title
    })
  }
}

export class OpenAgentTraceStudyMaterialCardModel extends Schema.Class<OpenAgentTraceStudyMaterialCardModel>(
  "OpenAgentTraceStudyMaterialCardModel"
)({
  description: Schema.String,
  emptyText: Schema.String,
  items: Schema.Array(OpenAgentTraceDetailItem),
  key: OpenAgentTraceStudyMaterialLaneSchema,
  title: Schema.String
}) {
  private static consumerArtifacts(
    studyMaterial: OpenAgentTraceConsumerArtifactStudyMaterial
  ): ReadonlyArray<OpenAgentTraceDetailItem> {
    return studyMaterial.items.map((artifact) =>
      OpenAgentTraceDetailItem.make({
        detail: artifact.detail(),
        label: artifact.title
      })
    )
  }

  private static workflowHookups(
    studyMaterial: OpenAgentTraceWorkflowHookupStudyMaterial
  ): ReadonlyArray<OpenAgentTraceDetailItem> {
    return studyMaterial.items.map((hookup) =>
      OpenAgentTraceDetailItem.make({
        detail: hookup.detail(),
        label: hookup.workflowKind
      })
    )
  }

  static project(studyMaterial: OpenAgentTraceStudyMaterial): OpenAgentTraceStudyMaterialCardModel {
    return Match.value(studyMaterial).pipe(
      Match.tag("consumer-artifacts", (value) =>
        OpenAgentTraceStudyMaterialCardModel.make({
          key: value._tag,
          title: value.title(),
          description: value.description(),
          emptyText: value.emptyText(),
          items: OpenAgentTraceStudyMaterialCardModel.consumerArtifacts(value)
        })),
      Match.tag("workflow-hookups", (value) =>
        OpenAgentTraceStudyMaterialCardModel.make({
          key: value._tag,
          title: value.title(),
          description: value.description(),
          emptyText: value.emptyText(),
          items: OpenAgentTraceStudyMaterialCardModel.workflowHookups(value)
        })),
      Match.exhaustive
    )
  }
}

export class OpenAgentTracePanelModel extends Schema.Class<OpenAgentTracePanelModel>("OpenAgentTracePanelModel")({
  corpusLane: OpenAgentTraceCorpusLane,
  description: Schema.String,
  entries: Schema.Array(OpenAgentTraceEntryPanelModel),
  studyMaterials: Schema.Array(OpenAgentTraceStudyMaterialCardModel),
  summaryRows: Schema.Array(OpenAgentTraceSummaryRow)
}) {
  static project(data: OpenAgentTracePanelData): OpenAgentTracePanelModel {
    const summary = OpenAgentTraceSummary.project(data)

    return OpenAgentTracePanelModel.make({
      corpusLane: summary.corpusLane,
      description: summary.description,
      entries: data.registry.map(OpenAgentTraceEntryPanelModel.project),
      studyMaterials: data.studyMaterials.map(OpenAgentTraceStudyMaterialCardModel.project),
      summaryRows: summary.rows
    })
  }
}
