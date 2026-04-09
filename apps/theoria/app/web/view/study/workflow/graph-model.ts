import { Schema } from "effect"

import type { CanonicalFrame } from "../../../../contracts/study/workflow/canonical-step.js"
import {
  workflowGraphCardDetail,
  workflowGraphTraversalFallback
} from "../../../../contracts/study/workflow/surface-graph-presentation.js"
import {
  workflowAuthoredOptimizedAnchorLabel,
  workflowCurrentStepMeta,
  workflowCurrentStepText
} from "../../../../contracts/study/workflow/surface-phase-presentation.js"
import {
  workflowFixedNumberText,
  WorkflowGraphCardKeySchema,
  workflowOptionalNumberText,
  workflowTraversalText
} from "../../../../contracts/study/workflow/view-presentation.js"
import type { WorkflowEvidenceProjection } from "../../../state/workflow/workflow-evidence.js"

export class WorkflowGraphCardViewModel extends Schema.Class<WorkflowGraphCardViewModel>(
  "WorkflowGraphCardViewModel"
)({
  key: WorkflowGraphCardKeySchema,
  label: Schema.String,
  score: Schema.String,
  nodeCount: Schema.String,
  traversal: Schema.String,
  detail: Schema.String
}) {}

export class WorkflowGraphCardCatalog extends Schema.Class<WorkflowGraphCardCatalog>(
  "WorkflowGraphCardCatalog"
)({
  baseline: WorkflowGraphCardViewModel,
  authoredOptimized: WorkflowGraphCardViewModel,
  searchWinner: WorkflowGraphCardViewModel
}) {}

export class WorkflowGraphViewModel extends Schema.Class<WorkflowGraphViewModel>(
  "WorkflowGraphViewModel"
)({
  cardCatalog: WorkflowGraphCardCatalog,
  currentStep: Schema.String,
  currentStepMeta: Schema.String,
  cards: Schema.Array(WorkflowGraphCardViewModel)
}) {
  static project({
    evidence,
    frame
  }: {
    readonly evidence: WorkflowEvidenceProjection
    readonly frame: CanonicalFrame | null
  }): WorkflowGraphViewModel {
    const baselineTraversal = evidence.graphs.baseline.traversal
    const winnerTraversal = evidence.optimizationWinner?.winnerTraversal ?? evidence.graphs.optimized.traversal
    const winnerKnobs = evidence.optimizationWinner?.selectedKnobs.map(([key, value]) => `${key}=${value}`) ?? []
    const baselineScore = evidence.workflowDelta.aggregateScore.baseline
    const authoredScore = evidence.optimizationSummary?.winnerVsAuthoredOptimizedScore.baseline ?? null
    const winnerScore = evidence.optimizationSummary?.winnerVsAuthoredOptimizedScore.improved
      ?? evidence.optimizationProgress?.bestScore
      ?? null
    const baselineNodeCount = evidence.workflowDelta.graphNodes.baseline
    const authoredNodeCount = evidence.optimizationSummary?.winnerVsAuthoredOptimizedNodeCount.baseline ?? null
    const winnerNodeCount = evidence.optimizationSummary?.winnerVsAuthoredOptimizedNodeCount.improved ?? null
    const currentStep = currentStepFromFrame(frame)
    const optimizationProgress = evidence.optimizationProgress
    const currentStepText = workflowCurrentStepText(currentStep)
    const currentStepMeta = workflowCurrentStepMeta({
      bestScore: optimizationProgress?.bestScore ?? null,
      completedTrials: optimizationProgress?.completedTrials ?? null,
      currentScore: optimizationProgress?.currentScore ?? null,
      step: currentStep,
      trialBudget: optimizationProgress?.trialBudget ?? null
    })
    const bestSelection = optimizationProgress?.bestSelection ?? null
    const baselineCard = WorkflowGraphCardViewModel.make({
      key: "baseline",
      label: evidence.graphs.baseline.title,
      score: workflowFixedNumberText({ digits: 3, value: baselineScore }),
      nodeCount: workflowOptionalNumberText(baselineNodeCount),
      traversal: workflowTraversalText({
        fallback: workflowGraphTraversalFallback("baseline"),
        nodes: baselineTraversal
      }),
      detail: workflowGraphCardDetail({ bestSelection, kind: "baseline", winnerKnobs })
    })
    const authoredOptimizedCard = WorkflowGraphCardViewModel.make({
      key: "authored-optimized",
      label: workflowAuthoredOptimizedAnchorLabel(),
      score: workflowFixedNumberText({ digits: 3, value: authoredScore }),
      nodeCount: workflowOptionalNumberText(authoredNodeCount),
      traversal: workflowGraphTraversalFallback("authored-optimized"),
      detail: workflowGraphCardDetail({ bestSelection, kind: "authored-optimized", winnerKnobs })
    })
    const searchWinnerCard = WorkflowGraphCardViewModel.make({
      key: "search-winner",
      label: evidence.graphs.optimized.title,
      score: workflowFixedNumberText({ digits: 3, value: winnerScore }),
      nodeCount: workflowOptionalNumberText(winnerNodeCount),
      traversal: workflowTraversalText({
        fallback: workflowGraphTraversalFallback("search-winner"),
        nodes: winnerTraversal
      }),
      detail: workflowGraphCardDetail({ bestSelection, kind: "search-winner", winnerKnobs })
    })

    return WorkflowGraphViewModel.make({
      cardCatalog: WorkflowGraphCardCatalog.make({
        authoredOptimized: authoredOptimizedCard,
        baseline: baselineCard,
        searchWinner: searchWinnerCard
      }),
      currentStep: currentStepText,
      currentStepMeta,
      cards: [baselineCard, authoredOptimizedCard, searchWinnerCard]
    })
  }
}

const currentStepFromFrame = (frame: CanonicalFrame | null) =>
  frame !== null && frame.step._tag === "WorkflowCanonicalStep" ? frame.step : null
