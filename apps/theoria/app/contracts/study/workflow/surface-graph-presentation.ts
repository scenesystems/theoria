import { Match, Schema } from "effect"

import type { CanonicalFrame } from "./canonical-step.js"
import {
  workflowAuthoredOptimizedAnchorLabel,
  workflowCurrentStepMeta,
  workflowCurrentStepText
} from "./surface-phase-presentation.js"
import {
  workflowFixedNumberText,
  WorkflowGraphCardKeySchema,
  workflowOptionalNumberText,
  workflowTraversalText
} from "./view-presentation.js"

export type WorkflowGraphCardMetric = "nodes" | "score"

export type WorkflowGraphCardKind = "authored-optimized" | "baseline" | "search-winner"

export const workflowGraphCardDetail = ({
  bestSelection,
  kind,
  winnerKnobs
}: {
  readonly bestSelection: string | null
  readonly kind: WorkflowGraphCardKind
  readonly winnerKnobs: ReadonlyArray<string>
}): string =>
  Match.value(kind).pipe(
    Match.when("baseline", () => "Baseline path under the current study setup."),
    Match.when(
      "authored-optimized",
      () => "Authored improvement chosen before search begins."
    ),
    Match.when(
      "search-winner",
      () =>
        winnerKnobs.length > 0
          ? winnerKnobs.join(" · ")
          : bestSelection === null
          ? "Best-candidate details will appear here once search finds a leader."
          : `Leading candidate: ${bestSelection}`
    ),
    Match.exhaustive
  )

export const workflowGraphTraversalFallback = (kind: WorkflowGraphCardKind): string =>
  Match.value(kind).pipe(
    Match.when("baseline", () => "Run the study to load the baseline path."),
    Match.when("authored-optimized", () => "Authored improvement path ready for comparison."),
    Match.when("search-winner", () => "Winner path appears once search selects a candidate."),
    Match.exhaustive
  )

export const workflowGraphCardMetricLabel = (metric: WorkflowGraphCardMetric): string =>
  Match.value(metric).pipe(
    Match.when("nodes", () => "Nodes"),
    Match.when("score", () => "Score"),
    Match.exhaustive
  )

type WorkflowGraphProjection = {
  readonly title: string
  readonly traversal: ReadonlyArray<string>
}

type WorkflowOptimizationGraphProgress = {
  readonly bestScore: number | null
  readonly bestSelection: string | null
  readonly completedTrials: number | null
  readonly currentScore: number | null
  readonly trialBudget: number | null
} | null

type WorkflowOptimizationGraphSummary = {
  readonly winnerVsAuthoredOptimizedNodeCount: {
    readonly baseline: number | null
    readonly improved: number | null
  }
  readonly winnerVsAuthoredOptimizedScore: {
    readonly baseline: number | null
    readonly improved: number | null
  }
} | null

type WorkflowOptimizationWinnerGraph = {
  readonly selectedKnobs: ReadonlyArray<readonly [string, string]>
  readonly winnerTraversal: ReadonlyArray<string>
} | null

export type WorkflowGraphEvidenceProjection = {
  readonly graphs: {
    readonly baseline: WorkflowGraphProjection
    readonly optimized: WorkflowGraphProjection
  }
  readonly optimizationProgress: WorkflowOptimizationGraphProgress
  readonly optimizationSummary: WorkflowOptimizationGraphSummary
  readonly optimizationWinner: WorkflowOptimizationWinnerGraph
  readonly workflowDelta: {
    readonly aggregateScore: {
      readonly baseline: number | null
    }
    readonly graphNodes: {
      readonly baseline: number | null
    }
  }
}

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

export class WorkflowGraphViewModel extends Schema.Class<WorkflowGraphViewModel>("WorkflowGraphViewModel")({
  cardCatalog: WorkflowGraphCardCatalog,
  currentStep: Schema.String,
  currentStepMeta: Schema.String,
  cards: Schema.Array(WorkflowGraphCardViewModel)
}) {
  static project({
    evidence,
    frame
  }: {
    readonly evidence: WorkflowGraphEvidenceProjection
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
    const currentStep = frame !== null && frame.step._tag === "WorkflowCanonicalStep" ? frame.step : null
    const optimizationProgress = evidence.optimizationProgress
    const baselineCard = WorkflowGraphCardViewModel.make({
      key: "baseline",
      label: evidence.graphs.baseline.title,
      score: workflowFixedNumberText({ digits: 3, value: baselineScore }),
      nodeCount: workflowOptionalNumberText(baselineNodeCount),
      traversal: workflowTraversalText({
        fallback: workflowGraphTraversalFallback("baseline"),
        nodes: baselineTraversal
      }),
      detail: workflowGraphCardDetail({
        bestSelection: optimizationProgress?.bestSelection ?? null,
        kind: "baseline",
        winnerKnobs
      })
    })
    const authoredOptimizedCard = WorkflowGraphCardViewModel.make({
      key: "authored-optimized",
      label: workflowAuthoredOptimizedAnchorLabel(),
      score: workflowFixedNumberText({ digits: 3, value: authoredScore }),
      nodeCount: workflowOptionalNumberText(authoredNodeCount),
      traversal: workflowGraphTraversalFallback("authored-optimized"),
      detail: workflowGraphCardDetail({
        bestSelection: optimizationProgress?.bestSelection ?? null,
        kind: "authored-optimized",
        winnerKnobs
      })
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
      detail: workflowGraphCardDetail({
        bestSelection: optimizationProgress?.bestSelection ?? null,
        kind: "search-winner",
        winnerKnobs
      })
    })

    return WorkflowGraphViewModel.make({
      cardCatalog: WorkflowGraphCardCatalog.make({
        authoredOptimized: authoredOptimizedCard,
        baseline: baselineCard,
        searchWinner: searchWinnerCard
      }),
      currentStep: workflowCurrentStepText(currentStep),
      currentStepMeta: workflowCurrentStepMeta({
        bestScore: optimizationProgress?.bestScore ?? null,
        completedTrials: optimizationProgress?.completedTrials ?? null,
        currentScore: optimizationProgress?.currentScore ?? null,
        step: currentStep,
        trialBudget: optimizationProgress?.trialBudget ?? null
      }),
      cards: [baselineCard, authoredOptimizedCard, searchWinnerCard]
    })
  }
}
