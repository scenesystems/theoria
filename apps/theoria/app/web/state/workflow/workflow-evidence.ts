import { Schema } from "effect"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import {
  WorkflowDeltaProjection,
  WorkflowGraphCatalogProjection,
  WorkflowGraphEvidenceProjection
} from "./workflow-evidence-graph.js"
import { WorkflowNodeExecutionEvidenceProjection } from "./workflow-evidence-node-execution.js"
import { WorkflowOptimizationEvidenceProjection } from "./workflow-evidence-optimization.js"
import {
  WorkflowOptimizationProgressProjection,
  WorkflowOptimizationSnapshotProjection,
  WorkflowOptimizationStudyEventTraceProjection,
  WorkflowOptimizationSummaryProjection,
  WorkflowOptimizationWinnerProjection,
  WorkflowProjectedNodeExecution
} from "./workflow-evidence-schema.js"

export class WorkflowEvidenceProjection extends Schema.Class<WorkflowEvidenceProjection>("WorkflowEvidenceProjection")({
  workflowDelta: WorkflowDeltaProjection,
  graphs: WorkflowGraphCatalogProjection,
  nodeExecutions: Schema.Array(WorkflowProjectedNodeExecution),
  optimizationProgress: Schema.NullOr(WorkflowOptimizationProgressProjection),
  optimizationSnapshot: Schema.NullOr(WorkflowOptimizationSnapshotProjection),
  optimizationStudyEventTrace: Schema.NullOr(WorkflowOptimizationStudyEventTraceProjection),
  optimizationSummary: Schema.NullOr(WorkflowOptimizationSummaryProjection),
  optimizationWinner: Schema.NullOr(WorkflowOptimizationWinnerProjection)
}) {
  static project(sections: ReadonlyArray<EvidenceSection>): WorkflowEvidenceProjection {
    const graphEvidence = WorkflowGraphEvidenceProjection.project(sections)
    const nodeExecutionEvidence = WorkflowNodeExecutionEvidenceProjection.project(sections)
    const optimizationEvidence = WorkflowOptimizationEvidenceProjection.project(sections)

    return WorkflowEvidenceProjection.make({
      graphs: graphEvidence.graphs,
      nodeExecutions: nodeExecutionEvidence.entries,
      optimizationProgress: optimizationEvidence.optimizationProgress,
      optimizationSnapshot: optimizationEvidence.optimizationSnapshot,
      optimizationStudyEventTrace: optimizationEvidence.optimizationStudyEventTrace,
      optimizationSummary: optimizationEvidence.optimizationSummary,
      optimizationWinner: optimizationEvidence.optimizationWinner,
      workflowDelta: graphEvidence.workflowDelta
    })
  }
}
