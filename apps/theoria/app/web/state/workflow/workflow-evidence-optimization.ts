import { Schema } from "effect"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import {
  workflowEvidenceItemKeys,
  type WorkflowEvidenceSectionMatch,
  workflowEvidenceSectionsForFamily,
  workflowNumericComparisonValueByKey,
  workflowScalarValueByKey,
  workflowStringPairRows,
  workflowStringTripleRows,
  workflowTableRowsByKey,
  workflowTextValueByKey
} from "../../../contracts/study/workflow/evidence.js"
import {
  WorkflowNumericComparisonProjection,
  WorkflowOptimizationProgressProjection,
  WorkflowOptimizationSnapshotProjection,
  WorkflowOptimizationStudyEventTraceProjection,
  WorkflowOptimizationSummaryProjection,
  WorkflowOptimizationWinnerProjection
} from "./workflow-evidence-schema.js"

export class WorkflowOptimizationEvidenceProjection extends Schema.Class<WorkflowOptimizationEvidenceProjection>(
  "WorkflowOptimizationEvidenceProjection"
)({
  optimizationProgress: Schema.NullOr(WorkflowOptimizationProgressProjection),
  optimizationSnapshot: Schema.NullOr(WorkflowOptimizationSnapshotProjection),
  optimizationStudyEventTrace: Schema.NullOr(WorkflowOptimizationStudyEventTraceProjection),
  optimizationSummary: Schema.NullOr(WorkflowOptimizationSummaryProjection),
  optimizationWinner: Schema.NullOr(WorkflowOptimizationWinnerProjection)
}) {
  static project(sections: ReadonlyArray<EvidenceSection>): WorkflowOptimizationEvidenceProjection {
    const optimizationSections = workflowEvidenceSectionsForFamily({ family: "optimization", sections })
    const progressSection = optimizationSection(optimizationSections, "optimization-study-progress")
    const summarySection = optimizationSection(optimizationSections, "optimization-study-summary")
    const winnerSection = optimizationSection(optimizationSections, "optimization-winner")
    const snapshotSection = optimizationSection(optimizationSections, "optimization-snapshot")
    const eventTraceSection = optimizationSection(optimizationSections, "optimization-study-event-trace")

    return WorkflowOptimizationEvidenceProjection.make({
      optimizationProgress: progressSection === null
        ? null
        : WorkflowOptimizationProgressProjection.make({
          bestScore: workflowScalarValueByKey(progressSection, workflowEvidenceItemKeys.bestScore),
          bestSelection: workflowTextValueByKey(progressSection, workflowEvidenceItemKeys.bestSelection),
          completedTrials: workflowScalarValueByKey(progressSection, workflowEvidenceItemKeys.completedTrials),
          currentScore: workflowScalarValueByKey(progressSection, workflowEvidenceItemKeys.currentScore),
          currentSelection: workflowTextValueByKey(progressSection, workflowEvidenceItemKeys.currentSelection),
          trialBudget: workflowScalarValueByKey(progressSection, workflowEvidenceItemKeys.trialBudget)
        }),
      optimizationSnapshot: snapshotSection === null
        ? null
        : WorkflowOptimizationSnapshotProjection.make({
          facts: workflowStringPairRows(
            workflowTableRowsByKey(snapshotSection, workflowEvidenceItemKeys.snapshotFacts)
          ),
          snapshotJson: workflowTextValueByKey(snapshotSection, workflowEvidenceItemKeys.snapshotJson)
        }),
      optimizationStudyEventTrace: eventTraceSection === null
        ? null
        : WorkflowOptimizationStudyEventTraceProjection.make({
          rows: workflowStringTripleRows(
            workflowTableRowsByKey(eventTraceSection, workflowEvidenceItemKeys.studyEvents)
          )
        }),
      optimizationSummary: summarySection === null
        ? null
        : WorkflowOptimizationSummaryProjection.make({
          completedTrials: workflowScalarValueByKey(summarySection, workflowEvidenceItemKeys.completedTrials),
          recoveredOrImprovedAuthoredOptimized: workflowTextValueByKey(
            summarySection,
            workflowEvidenceItemKeys.recoveredOrImprovedAuthoredOptimized
          ),
          trialBudget: workflowScalarValueByKey(summarySection, workflowEvidenceItemKeys.trialBudget),
          winnerVsAuthoredOptimizedNodeCount: WorkflowNumericComparisonProjection.make(
            workflowNumericComparisonValueByKey(
              summarySection,
              workflowEvidenceItemKeys.winnerVsAuthoredOptimizedNodeCount
            )
          ),
          winnerVsAuthoredOptimizedScore: WorkflowNumericComparisonProjection.make(
            workflowNumericComparisonValueByKey(summarySection, workflowEvidenceItemKeys.winnerVsAuthoredOptimizedScore)
          )
        }),
      optimizationWinner: winnerSection === null
        ? null
        : WorkflowOptimizationWinnerProjection.make({
          selectedKnobs: workflowStringPairRows(
            workflowTableRowsByKey(winnerSection, workflowEvidenceItemKeys.selectedKnobs)
          ),
          winnerRecord: workflowTextValueByKey(winnerSection, workflowEvidenceItemKeys.winnerRecord),
          winnerTraversal: (workflowTextValueByKey(winnerSection, workflowEvidenceItemKeys.winnerTraversal) ?? "")
            .split(" -> ")
            .filter((value) => value.length > 0)
        })
    })
  }
}

const optimizationSection = (
  sections: ReadonlyArray<WorkflowEvidenceSectionMatch<"optimization">>,
  meaning: WorkflowEvidenceSectionMatch<"optimization">["descriptor"]["meaning"]
): EvidenceSection | null => sections.find((section) => section.descriptor.meaning === meaning)?.section ?? null
