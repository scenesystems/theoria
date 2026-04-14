import { Schema } from "effect"

import type { EvidenceSection } from "../../evidence/item.js"
import { WorkflowProjectedNodeExecution } from "./evidence-projection-schema.js"
import { workflowEvidenceSectionTitle } from "./evidence-section-title.js"
import {
  workflowEvidenceItemKeys,
  workflowEvidenceSectionsForFamily,
  workflowScalarValueByKey,
  workflowTextValueByKey
} from "./evidence.js"

export class WorkflowNodeExecutionEvidenceProjection extends Schema.Class<WorkflowNodeExecutionEvidenceProjection>(
  "WorkflowNodeExecutionEvidenceProjection"
)({
  entries: Schema.Array(WorkflowProjectedNodeExecution)
}) {
  static project(sections: ReadonlyArray<EvidenceSection>): WorkflowNodeExecutionEvidenceProjection {
    return WorkflowNodeExecutionEvidenceProjection.make({
      entries: workflowEvidenceSectionsForFamily({ family: "node-execution", sections }).map(
        ({ descriptor, section }) =>
          WorkflowProjectedNodeExecution.make({
            durationMs: workflowScalarValueByKey(section, workflowEvidenceItemKeys.traceDuration),
            key: descriptor.key,
            nodeId: descriptor.nodeId,
            nodeKind: descriptor.nodeKind,
            output: workflowTextValueByKey(section, workflowEvidenceItemKeys.output),
            prompt: workflowTextValueByKey(section, workflowEvidenceItemKeys.prompt),
            rawResponse: workflowTextValueByKey(section, workflowEvidenceItemKeys.rawResponse),
            totalTokens: workflowScalarValueByKey(section, workflowEvidenceItemKeys.totalTokens),
            title: workflowEvidenceSectionTitle(descriptor),
            variant: descriptor.variant
          })
      )
    })
  }
}
