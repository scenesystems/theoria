import { EvidenceSection, ScalarItem, TextItem } from "../../../../contracts/evidence/item.js"
import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import { canonicalStepEvent, Choreography, SectionUpsert } from "../../../../contracts/evidence/stream.js"
import { StageAdvance, StageEnter } from "../../../../contracts/study/workflow/choreography.js"
import {
  workflowEvidenceItemKeys,
  workflowEvidenceItemLabels,
  workflowEvidenceSectionKeys,
  workflowEvidenceSectionTitles
} from "../../../../contracts/study/workflow/evidence.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import { optimizedWorkflowCanonicalStep } from "../../../../contracts/study/workflow/step.js"
import type { WorkflowSearchDimension } from "../search/dimensions.js"
import { aggregateScoreForEvaluation } from "../search/progress.js"
import type { WorkflowSearchEvaluation } from "../search/schema.js"
import { formatSelection } from "./search-detail.js"

const optimizationStudyProgressSection = ({
  best,
  completedTrials,
  current,
  dimensions,
  trialBudget
}: {
  readonly best: WorkflowSearchEvaluation
  readonly completedTrials: number
  readonly current: WorkflowSearchEvaluation
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly trialBudget: number
}) =>
  EvidenceSection.make({
    key: workflowEvidenceSectionKeys.optimizationStudyProgress,
    title: workflowEvidenceSectionTitles.optimizationStudyProgress,
    items: [
      ScalarItem.make({
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.completedTrials,
        label: workflowEvidenceItemLabels.completedTrials,
        value: completedTrials,
        unit: "trials",
        format: "integer"
      }),
      ScalarItem.make({
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.trialBudget,
        label: workflowEvidenceItemLabels.trialBudget,
        value: trialBudget,
        unit: "trials",
        format: "integer"
      }),
      TextItem.make({
        _tag: "Text",
        key: workflowEvidenceItemKeys.currentSelection,
        label: workflowEvidenceItemLabels.currentSelection,
        value: formatSelection({ dimensions, selection: current.selection })
      }),
      ScalarItem.make({
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.currentScore,
        label: workflowEvidenceItemLabels.currentScore,
        value: aggregateScoreForEvaluation(current),
        unit: "score",
        format: "fixed"
      }),
      TextItem.make({
        _tag: "Text",
        key: workflowEvidenceItemKeys.bestSelection,
        label: workflowEvidenceItemLabels.bestSelection,
        value: formatSelection({ dimensions, selection: best.selection })
      }),
      ScalarItem.make({
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.bestScore,
        label: workflowEvidenceItemLabels.bestScore,
        value: aggregateScoreForEvaluation(best),
        unit: "score",
        format: "fixed"
      })
    ]
  })

export const workflowSearchStartedEvents = ({
  trialBudget
}: {
  readonly trialBudget: number
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({
    cue: new StageEnter({ stageId: "optimization-study", params: { trialBudget, stepCount: trialBudget } })
  })
]

export const workflowSearchProgressEvents = ({
  best,
  workflowRun,
  completedTrials,
  current,
  dimensions,
  trialBudget
}: {
  readonly best: WorkflowSearchEvaluation
  readonly workflowRun: FrozenWorkflowRun
  readonly completedTrials: number
  readonly current: WorkflowSearchEvaluation
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly trialBudget: number
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageAdvance({ stageId: "optimization-study", step: completedTrials - 1 }) }),
  canonicalStepEvent(
    optimizedWorkflowCanonicalStep({
      seedId: workflowRun.seedId,
      workflowKind: workflowRun.workflowKind,
      nodeId: "optimization-study",
      nodeKind: "critic",
      runtimeRole: "critic",
      stepIndex: completedTrials,
      stepCount: trialBudget,
      lineage: ["optimization-study"],
      activeStateLanes: ["conversation"],
      outputText:
        `Completed ${completedTrials}/${trialBudget} optimization trials. Current ${current.selectionKey} scored ${
          aggregateScoreForEvaluation(current).toFixed(6)
        }`
        + `; best so far is ${best.selectionKey} at ${aggregateScoreForEvaluation(best).toFixed(6)}.`,
      aggregateScore: aggregateScoreForEvaluation(best)
    })
  ),
  new SectionUpsert({
    section: optimizationStudyProgressSection({
      best,
      completedTrials,
      current,
      dimensions,
      trialBudget
    })
  })
]
