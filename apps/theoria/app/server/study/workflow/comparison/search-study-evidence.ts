import { Schema } from "effect"
import { Study } from "effect-search"

import type { EvidenceItem, EvidenceSection } from "../../../../contracts/evidence/item.js"
import { Choreography, type EvidenceEvent, SectionAppend } from "../../../../contracts/evidence/stream.js"
import { StageExit } from "../../../../contracts/study/workflow/choreography.js"
import {
  workflowComparisonEvidenceItemKeys,
  workflowComparisonEvidenceSectionKeys
} from "../../../../contracts/study/workflow/comparison/evidence.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { formatEventDetail, selectionRows } from "./search-study-progress.js"
import type { WorkflowComparisonSearchStudyOutcome } from "./search-study-schema.js"
import type { WorkflowComparisonSearchDimension } from "./search-study-space.js"

const encodeStudySnapshotJson = Schema.encodeSync(Schema.parseJson(Study.StudySnapshot))

const itemText = (label: string, value: string, key?: string): EvidenceItem => ({
  _tag: "Text",
  key,
  label,
  value
})

const optimizationStudySections = ({
  comparison,
  dimensions,
  outcome
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly outcome: WorkflowComparisonSearchStudyOutcome
}): ReadonlyArray<EvidenceSection> => {
  const authoredScore = outcome.authored.execution.report.aggregateScore
  const winnerScore = outcome.winner.execution.report.aggregateScore

  return [
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationStudySummary,
      title: "Optimization Study Summary",
      items: [
        {
          _tag: "Scalar",
          key: workflowComparisonEvidenceItemKeys.trialBudget,
          label: "Trial budget",
          value: outcome.trialBudget,
          unit: "trials",
          format: "integer"
        },
        {
          _tag: "Scalar",
          key: workflowComparisonEvidenceItemKeys.completedTrials,
          label: "Completed trials",
          value: outcome.snapshot.completedCount,
          unit: "trials",
          format: "integer"
        },
        {
          _tag: "Comparison",
          key: workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedScore,
          label: "Winner vs authored optimized score",
          baseline: authoredScore,
          improved: winnerScore,
          unit: "score",
          direction: "higher-is-better"
        },
        {
          _tag: "Comparison",
          key: workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedNodeCount,
          label: "Winner vs authored optimized node count",
          baseline: outcome.authored.execution.record.graph.nodes.length,
          improved: outcome.winner.execution.record.graph.nodes.length,
          unit: "count",
          direction: "higher-is-better"
        },
        itemText(
          "Recovered or improved authored optimized",
          winnerScore >= authoredScore ? "yes" : "no",
          workflowComparisonEvidenceItemKeys.recoveredOrImprovedAuthoredOptimized
        )
      ]
    },
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationWinner,
      title: "Optimization Winner",
      items: [
        {
          _tag: "Table",
          key: workflowComparisonEvidenceItemKeys.selectedKnobs,
          label: "Selected knobs",
          columns: ["Knob", "Choice"],
          rows: selectionRows({ dimensions, selection: outcome.winner.selection })
        },
        itemText(
          "Winner record",
          outcome.winner.execution.record.recordId,
          workflowComparisonEvidenceItemKeys.winnerRecord
        ),
        itemText(
          "Winner traversal",
          outcome.winner.execution.graphProjection.traversal.join(" -> "),
          workflowComparisonEvidenceItemKeys.winnerTraversal
        )
      ]
    },
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationSnapshot,
      title: "Optimization Snapshot",
      items: [
        {
          _tag: "Table",
          key: workflowComparisonEvidenceItemKeys.snapshotFacts,
          label: "Snapshot facts",
          columns: ["Field", "Value"],
          rows: [
            ["comparison", comparison.comparisonId],
            ["snapshot format", `${outcome.snapshot.snapshotFormatVersion}`],
            ["next trial number", `${outcome.snapshot.nextTrialNumber}`],
            ["completed count", `${outcome.snapshot.completedCount}`],
            ["trial count", `${outcome.snapshot.trials.length}`],
            ["study duration", `${outcome.snapshot.studyDuration}`],
            ["sampler kind", outcome.snapshot.samplerKind._tag],
            ["space fingerprint", outcome.snapshot.spaceFingerprint]
          ]
        },
        itemText(
          "Snapshot JSON",
          encodeStudySnapshotJson(outcome.snapshot),
          workflowComparisonEvidenceItemKeys.snapshotJson
        )
      ]
    },
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationStudyEventTrace,
      title: "Optimization Study Event Trace",
      items: [
        {
          _tag: "Table",
          key: workflowComparisonEvidenceItemKeys.studyEvents,
          label: "Study events",
          columns: ["#", "Event", "Detail"],
          rows: outcome.events.map((event, index) => [
            `${index + 1}`,
            event._tag,
            formatEventDetail({ dimensions, event })
          ])
        }
      ]
    }
  ]
}

export const optimizationStudyCompletedEvents = ({
  comparison,
  dimensions,
  outcome
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly outcome: WorkflowComparisonSearchStudyOutcome
}): ReadonlyArray<EvidenceEvent> => [
  ...optimizationStudySections({ comparison, dimensions, outcome }).map((section) => new SectionAppend({ section })),
  new Choreography({ cue: new StageExit({ stageId: "optimization-study" }) })
]
