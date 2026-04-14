import { Match, Schema } from "effect"

import { workflowReferenceFromOpenAgentTraceEntry } from "../catalog.js"
import { WorkflowReference } from "../revision.js"
import { OpenAgentTraceCorpusLane } from "./corpus-lane.js"
import { OpenAgentTraceDetailItem } from "./detail-item.js"
import { OpenAgentTracePanelGroupDescriptor } from "./panel-presentation.js"
import { OpenAgentTracePanelGroup } from "./panel-section.js"
import {
  type OpenAgentTraceConsumerArtifactStudyMaterial,
  OpenAgentTraceEntryIdSchema,
  type OpenAgentTracePanelData,
  type OpenAgentTraceRegistryEntry,
  type OpenAgentTraceStudyMaterial,
  OpenAgentTraceStudyMaterialLaneSchema,
  type OpenAgentTraceWorkflowHookupStudyMaterial
} from "./study-material.js"
import { OpenAgentTraceSummaryRow } from "./summary-row.js"

export class OpenAgentTraceEntryPanelModel extends Schema.Class<OpenAgentTraceEntryPanelModel>(
  "OpenAgentTraceEntryPanelModel"
)({
  eyebrow: Schema.String,
  entryId: OpenAgentTraceEntryIdSchema,
  groups: Schema.Array(OpenAgentTracePanelGroup),
  summary: Schema.String,
  title: Schema.String,
  workflowReference: WorkflowReference
}) {
  static project(entry: OpenAgentTraceRegistryEntry): OpenAgentTraceEntryPanelModel {
    return OpenAgentTraceEntryPanelModel.make({
      entryId: entry.entryId,
      eyebrow: entry.eyebrow,
      groups: OpenAgentTracePanelGroupDescriptor.forEntryId(entry.entryId).map((descriptor) =>
        OpenAgentTracePanelGroup.project({ descriptor, entry })
      ),
      summary: entry.summary,
      title: entry.title,
      workflowReference: workflowReferenceFromOpenAgentTraceEntry(entry)
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
    const corpusLane = OpenAgentTraceCorpusLane.project(data.registry)

    return OpenAgentTracePanelModel.make({
      corpusLane,
      description: corpusLane.description(),
      entries: data.registry.map(OpenAgentTraceEntryPanelModel.project),
      studyMaterials: data.studyMaterials.map(OpenAgentTraceStudyMaterialCardModel.project),
      summaryRows: OpenAgentTraceSummaryRow.summarize({ corpusLane, data })
    })
  }
}
