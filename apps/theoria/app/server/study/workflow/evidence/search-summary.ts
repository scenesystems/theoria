import { Schema } from "effect"
import { Study } from "effect-search"

import {
  ComparisonItem,
  EvidenceSection,
  ScalarItem,
  TableItem,
  TextItem
} from "../../../../contracts/evidence/item.js"
import { Choreography, type EvidenceEvent, SectionAppend } from "../../../../contracts/evidence/stream.js"
import { presentationDetailRowsTableRows } from "../../../../contracts/presentation/detail-row.js"
import { StageExit } from "../../../../contracts/study/workflow/choreography.js"
import {
  workflowEvidenceItemKeys,
  workflowEvidenceItemLabels,
  workflowEvidenceSectionKeys,
  workflowEvidenceSectionTitles,
  workflowEvidenceTableColumns,
  workflowOptimizationSnapshotFacts
} from "../../../../contracts/study/workflow/evidence.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowSearchDimension } from "../search/dimensions.js"
import type { WorkflowSearchStudyOutcome } from "../search/schema.js"
import { formatEventDetail, selectionRows } from "./search-detail.js"

const encodeStudySnapshotJson = Schema.encodeSync(Schema.parseJson(Study.StudySnapshot))

const optimizationStudySections = ({
  workflowRun,
  dimensions,
  outcome
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly outcome: WorkflowSearchStudyOutcome
}) => {
  const authoredScore = outcome.authored.execution.report.aggregateScore
  const winnerScore = outcome.winner.execution.report.aggregateScore

  return [
    EvidenceSection.make({
      key: workflowEvidenceSectionKeys.optimizationStudySummary,
      title: workflowEvidenceSectionTitles.optimizationStudySummary,
      items: [
        ScalarItem.make({
          _tag: "Scalar",
          key: workflowEvidenceItemKeys.trialBudget,
          label: workflowEvidenceItemLabels.trialBudget,
          value: outcome.trialBudget,
          unit: "trials",
          format: "integer"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          key: workflowEvidenceItemKeys.completedTrials,
          label: workflowEvidenceItemLabels.completedTrials,
          value: outcome.snapshot.completedCount,
          unit: "trials",
          format: "integer"
        }),
        ComparisonItem.make({
          _tag: "Comparison",
          key: workflowEvidenceItemKeys.winnerVsAuthoredOptimizedScore,
          label: workflowEvidenceItemLabels.winnerVsAuthoredOptimizedScore,
          baseline: authoredScore,
          improved: winnerScore,
          unit: "score",
          direction: "higher-is-better"
        }),
        ComparisonItem.make({
          _tag: "Comparison",
          key: workflowEvidenceItemKeys.winnerVsAuthoredOptimizedNodeCount,
          label: workflowEvidenceItemLabels.winnerVsAuthoredOptimizedNodeCount,
          baseline: outcome.authored.execution.record.graph.nodes.length,
          improved: outcome.winner.execution.record.graph.nodes.length,
          unit: "count",
          direction: "higher-is-better"
        }),
        TextItem.make({
          _tag: "Text",
          key: workflowEvidenceItemKeys.recoveredOrImprovedAuthoredOptimized,
          label: workflowEvidenceItemLabels.recoveredOrImprovedAuthoredOptimized,
          value: winnerScore >= authoredScore ? "yes" : "no"
        })
      ]
    }),
    EvidenceSection.make({
      key: workflowEvidenceSectionKeys.optimizationWinner,
      title: workflowEvidenceSectionTitles.optimizationWinner,
      items: [
        TableItem.make({
          _tag: "Table",
          key: workflowEvidenceItemKeys.selectedKnobs,
          label: workflowEvidenceItemLabels.selectedKnobs,
          columns: [...workflowEvidenceTableColumns.optimizationWinner],
          rows: selectionRows({ dimensions, selection: outcome.winner.selection })
        }),
        TextItem.make({
          _tag: "Text",
          key: workflowEvidenceItemKeys.winnerRecord,
          label: workflowEvidenceItemLabels.winnerRecord,
          value: outcome.winner.execution.record.recordId
        }),
        TextItem.make({
          _tag: "Text",
          key: workflowEvidenceItemKeys.winnerTraversal,
          label: workflowEvidenceItemLabels.winnerTraversal,
          value: outcome.winner.execution.graphProjection.traversal.join(" -> ")
        })
      ]
    }),
    EvidenceSection.make({
      key: workflowEvidenceSectionKeys.optimizationSnapshot,
      title: workflowEvidenceSectionTitles.optimizationSnapshot,
      items: [
        TableItem.make({
          _tag: "Table",
          key: workflowEvidenceItemKeys.snapshotFacts,
          label: workflowEvidenceItemLabels.snapshotFacts,
          columns: [...workflowEvidenceTableColumns.optimizationSnapshot],
          rows: presentationDetailRowsTableRows(workflowOptimizationSnapshotFacts({
            workflowSeedId: workflowRun.seedId,
            snapshotFormatVersion: outcome.snapshot.snapshotFormatVersion,
            nextTrialNumber: outcome.snapshot.nextTrialNumber,
            completedCount: outcome.snapshot.completedCount,
            trialCount: outcome.snapshot.trials.length,
            studyDuration: outcome.snapshot.studyDuration,
            samplerKind: outcome.snapshot.samplerKind._tag,
            spaceFingerprint: outcome.snapshot.spaceFingerprint
          }))
        }),
        TextItem.make({
          _tag: "Text",
          key: workflowEvidenceItemKeys.snapshotJson,
          label: workflowEvidenceItemLabels.snapshotJson,
          value: encodeStudySnapshotJson(outcome.snapshot)
        })
      ]
    }),
    EvidenceSection.make({
      key: workflowEvidenceSectionKeys.optimizationStudyEventTrace,
      title: workflowEvidenceSectionTitles.optimizationStudyEventTrace,
      items: [
        TableItem.make({
          _tag: "Table",
          key: workflowEvidenceItemKeys.studyEvents,
          label: workflowEvidenceItemLabels.studyEvents,
          columns: [...workflowEvidenceTableColumns.optimizationStudyEventTrace],
          rows: outcome.events.map((event, index) => [
            `${index + 1}`,
            event._tag,
            formatEventDetail({ dimensions, event })
          ])
        })
      ]
    })
  ]
}

export const workflowSearchCompletedEvents = ({
  workflowRun,
  dimensions,
  outcome
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly outcome: WorkflowSearchStudyOutcome
}): ReadonlyArray<EvidenceEvent> => [
  ...optimizationStudySections({ workflowRun, dimensions, outcome }).map((section) => new SectionAppend({ section })),
  new Choreography({ cue: new StageExit({ stageId: "optimization-study" }) })
]
