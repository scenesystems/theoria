import { Schema } from "effect"

import type { EvidenceSection } from "../../evidence/item.js"
import {
  WorkflowDeltaProjection,
  WorkflowGraphCatalogProjection,
  WorkflowGraphEvidenceProjection
} from "./evidence-graph-presentation.js"
import { WorkflowNodeExecutionEvidenceProjection } from "./evidence-node-execution-presentation.js"
import { WorkflowOptimizationEvidenceProjection } from "./evidence-optimization-presentation.js"
import {
  WorkflowOptimizationProgressProjection,
  WorkflowOptimizationSnapshotProjection,
  WorkflowOptimizationStudyEventTraceProjection,
  WorkflowOptimizationSummaryProjection,
  WorkflowOptimizationWinnerProjection,
  WorkflowProjectedNodeExecution
} from "./evidence-projection-schema.js"

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
