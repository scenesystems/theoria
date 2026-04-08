import { Option } from "effect"

import type { EvidenceSection } from "../../../../contracts/evidence/item.js"
import {
  workflowComparisonEvidenceItemKeys,
  workflowComparisonEvidenceSectionKeys,
  workflowComparisonVariantOverviewSectionKey
} from "../../../../contracts/study/workflow/comparison/evidence.js"
import {
  comparisonItemByKey,
  leadingTextFromRow,
  parseNodeExecutionSectionKey,
  scalarValueByKey,
  sectionByKey,
  stringPairFromRow,
  stringTripleFromRow,
  tableItemByKey,
  textValueByKey
} from "./evidence-projection-helpers.js"
import type {
  WorkflowComparisonEvidenceProjection,
  WorkflowComparisonNumericComparisonProjection,
  WorkflowComparisonOptimizationProgressProjection,
  WorkflowComparisonOptimizationSnapshotProjection,
  WorkflowComparisonOptimizationStudyEventTraceProjection,
  WorkflowComparisonOptimizationSummaryProjection,
  WorkflowComparisonOptimizationWinnerProjection,
  WorkflowComparisonVariantGraphProjection
} from "./evidence-projection-schema.js"

const comparisonValueByKey = (
  section: EvidenceSection | null,
  key: string
): WorkflowComparisonNumericComparisonProjection => {
  const item = comparisonItemByKey(section, key)

  return {
    baseline: item?.baseline ?? null,
    improved: item?.improved ?? null
  }
}

const graphProjectionForSection = (section: EvidenceSection | null): WorkflowComparisonVariantGraphProjection => ({
  traversal: (tableItemByKey(section, workflowComparisonEvidenceItemKeys.traversal)?.rows ?? []).flatMap(
    leadingTextFromRow
  ),
  traversalSteps: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.traversalSteps)
})

const optimizationProgressProjection = (
  sections: ReadonlyArray<EvidenceSection>
): WorkflowComparisonOptimizationProgressProjection | null => {
  const section = sectionByKey(sections, workflowComparisonEvidenceSectionKeys.optimizationStudyProgress)

  return section === null
    ? null
    : {
      bestScore: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.bestScore),
      bestSelection: textValueByKey(section, workflowComparisonEvidenceItemKeys.bestSelection),
      completedTrials: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.completedTrials),
      currentScore: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.currentScore),
      currentSelection: textValueByKey(section, workflowComparisonEvidenceItemKeys.currentSelection),
      trialBudget: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.trialBudget)
    }
}

const optimizationSummaryProjection = (
  sections: ReadonlyArray<EvidenceSection>
): WorkflowComparisonOptimizationSummaryProjection | null => {
  const section = sectionByKey(sections, workflowComparisonEvidenceSectionKeys.optimizationStudySummary)

  return section === null
    ? null
    : {
      completedTrials: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.completedTrials),
      recoveredOrImprovedAuthoredOptimized: textValueByKey(
        section,
        workflowComparisonEvidenceItemKeys.recoveredOrImprovedAuthoredOptimized
      ),
      trialBudget: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.trialBudget),
      winnerVsAuthoredOptimizedNodeCount: comparisonValueByKey(
        section,
        workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedNodeCount
      ),
      winnerVsAuthoredOptimizedScore: comparisonValueByKey(
        section,
        workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedScore
      )
    }
}

const optimizationWinnerProjection = (
  sections: ReadonlyArray<EvidenceSection>
): WorkflowComparisonOptimizationWinnerProjection | null => {
  const section = sectionByKey(sections, workflowComparisonEvidenceSectionKeys.optimizationWinner)

  return section === null
    ? null
    : {
      selectedKnobs: (tableItemByKey(section, workflowComparisonEvidenceItemKeys.selectedKnobs)?.rows ?? []).flatMap(
        stringPairFromRow
      ),
      winnerRecord: textValueByKey(section, workflowComparisonEvidenceItemKeys.winnerRecord),
      winnerTraversal: (textValueByKey(section, workflowComparisonEvidenceItemKeys.winnerTraversal) ?? "")
        .split(" -> ")
        .filter((value) => value.length > 0)
    }
}

const optimizationSnapshotProjection = (
  sections: ReadonlyArray<EvidenceSection>
): WorkflowComparisonOptimizationSnapshotProjection | null => {
  const section = sectionByKey(sections, workflowComparisonEvidenceSectionKeys.optimizationSnapshot)

  return section === null
    ? null
    : {
      facts: (tableItemByKey(section, workflowComparisonEvidenceItemKeys.snapshotFacts)?.rows ?? []).flatMap(
        stringPairFromRow
      ),
      snapshotJson: textValueByKey(section, workflowComparisonEvidenceItemKeys.snapshotJson)
    }
}

const optimizationStudyEventTraceProjection = (
  sections: ReadonlyArray<EvidenceSection>
): WorkflowComparisonOptimizationStudyEventTraceProjection | null => {
  const section = sectionByKey(sections, workflowComparisonEvidenceSectionKeys.optimizationStudyEventTrace)

  return section === null
    ? null
    : {
      rows: (tableItemByKey(section, workflowComparisonEvidenceItemKeys.studyEvents)?.rows ?? []).flatMap(
        stringTripleFromRow
      )
    }
}

export const workflowComparisonEvidenceProjectionFromSections = (
  sections: ReadonlyArray<EvidenceSection>
): WorkflowComparisonEvidenceProjection => ({
  comparisonDelta: {
    aggregateScore: comparisonValueByKey(
      sectionByKey(sections, workflowComparisonEvidenceSectionKeys.comparisonDelta),
      workflowComparisonEvidenceItemKeys.aggregateScore
    ),
    graphNodes: comparisonValueByKey(
      sectionByKey(sections, workflowComparisonEvidenceSectionKeys.comparisonDelta),
      workflowComparisonEvidenceItemKeys.graphNodes
    )
  },
  graphs: {
    baseline: graphProjectionForSection(
      sectionByKey(sections, workflowComparisonVariantOverviewSectionKey("baseline"))
    ),
    optimized: graphProjectionForSection(
      sectionByKey(sections, workflowComparisonVariantOverviewSectionKey("optimized"))
    )
  },
  nodeExecutions: sections.flatMap((section) => {
    const descriptor = parseNodeExecutionSectionKey(Option.fromNullable(section.key))

    return descriptor === null
      ? []
      : [{
        durationMs: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.traceDuration),
        key: descriptor.key,
        nodeId: descriptor.nodeId,
        nodeKind: descriptor.nodeKind,
        output: textValueByKey(section, workflowComparisonEvidenceItemKeys.output),
        prompt: textValueByKey(section, workflowComparisonEvidenceItemKeys.prompt),
        rawResponse: textValueByKey(section, workflowComparisonEvidenceItemKeys.rawResponse),
        totalTokens: scalarValueByKey(section, workflowComparisonEvidenceItemKeys.totalTokens),
        variant: descriptor.variant
      }]
  }),
  optimizationProgress: optimizationProgressProjection(sections),
  optimizationSnapshot: optimizationSnapshotProjection(sections),
  optimizationStudyEventTrace: optimizationStudyEventTraceProjection(sections),
  optimizationSummary: optimizationSummaryProjection(sections),
  optimizationWinner: optimizationWinnerProjection(sections)
})
